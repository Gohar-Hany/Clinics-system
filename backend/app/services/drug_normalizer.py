"""
Drug Entity Normalizer — Matches LLM-suggested drug names
against local drug database to prevent hallucinations.
"""

import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

try:
    from thefuzz import fuzz, process
except ImportError:
    # Basic fallback if thefuzz is not installed
    class _FuzzFallback:
        @staticmethod
        def token_sort_ratio(s1: str, s2: str) -> int:
            return 100 if s1.lower() == s2.lower() else (75 if s1.lower() in s2.lower() or s2.lower() in s1.lower() else 0)

    class _ProcessFallback:
        @staticmethod
        def extractOne(query: str, choices: list[str], scorer=None):
            for choice in choices:
                if query.lower() == choice.lower():
                    return (choice, 100)
            for choice in choices:
                if query.lower() in choice.lower() or choice.lower() in query.lower():
                    return (choice, 80)
            return None

        @staticmethod
        def extract(query: str, choices: list[str], scorer=None, limit: int = 5):
            results = []
            for choice in choices:
                if query.lower() in choice.lower():
                    results.append((choice, 85, 0))
            return results[:limit]

    fuzz = _FuzzFallback()
    process = _ProcessFallback()


class DrugNormalizer:
    """
    Fuzzy-matches drug names against local Egyptian drug database.
    Prevents LLM hallucinations in prescription generation.
    """

    def __init__(self):
        self._drugs: list[dict] = []
        self._brand_names: list[str] = []
        self._generic_names: list[str] = []
        self._loaded = False

    def load(self, db_path: str | None = None) -> None:
        """Load drug database from JSON file."""
        if self._loaded:
            return

        if db_path is None:
            db_path = os.path.join(
                os.path.dirname(os.path.dirname(__file__)),
                "data", "drugs_egypt.json"
            )

        with open(db_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self._drugs = data["drugs"]
        self._brand_names = [d["brand_name"] for d in self._drugs]
        self._generic_names = [d["generic_name"] for d in self._drugs]
        self._loaded = True

        logger.info(f"Drug database loaded: {len(self._drugs)} medications")

    def normalize(self, drug_name: str, threshold: int = 70) -> dict:
        """
        Normalize a drug name against the local database.

        Args:
            drug_name: The drug name from LLM output
            threshold: Minimum fuzzy match score (0-100)

        Returns:
            Dict with normalized info or flagged as unrecognized
        """
        if not self._loaded:
            self.load()

        drug_name_clean = drug_name.strip()

        # 1. Try exact match (case-insensitive) on brand names
        for drug in self._drugs:
            if drug["brand_name"].lower() == drug_name_clean.lower():
                return self._format_match(drug, 100, "exact_brand")

        # 2. Try exact match on generic names
        for drug in self._drugs:
            if drug["generic_name"].lower() == drug_name_clean.lower():
                return self._format_match(drug, 100, "exact_generic")

        # 3. Fuzzy match on brand names
        brand_match = process.extractOne(
            drug_name_clean,
            self._brand_names,
            scorer=fuzz.token_sort_ratio,
        )
        if brand_match and brand_match[1] >= threshold:
            matched_drug = self._drugs[self._brand_names.index(brand_match[0])]
            return self._format_match(matched_drug, brand_match[1], "fuzzy_brand")

        # 4. Fuzzy match on generic names
        generic_match = process.extractOne(
            drug_name_clean,
            self._generic_names,
            scorer=fuzz.token_sort_ratio,
        )
        if generic_match and generic_match[1] >= threshold:
            matched_drug = self._drugs[self._generic_names.index(generic_match[0])]
            return self._format_match(matched_drug, generic_match[1], "fuzzy_generic")

        # 5. No match found
        return {
            "original_name": drug_name,
            "matched": False,
            "confidence": 0,
            "match_type": "none",
            "warning": f"⚠️ لم يتم التعرف على الدواء: {drug_name}",
        }

    def normalize_dosage(self, drug_name: str, dosage: str) -> dict:
        """
        Verify a dosage exists for a given drug.

        Args:
            drug_name: Normalized drug name
            dosage: Dosage string (e.g., "500mg")

        Returns:
            Dict with verification result
        """
        if not self._loaded:
            self.load()

        for drug in self._drugs:
            if (drug["brand_name"].lower() == drug_name.lower() or
                    drug["generic_name"].lower() == drug_name.lower()):
                dosage_clean = dosage.strip().lower()
                available = [d.lower() for d in drug["dosages"]]

                if dosage_clean in available:
                    return {
                        "valid": True,
                        "dosage": dosage,
                        "available_dosages": drug["dosages"],
                    }
                else:
                    return {
                        "valid": False,
                        "dosage": dosage,
                        "available_dosages": drug["dosages"],
                        "warning": f"⚠️ التركيز {dosage} غير متاح. المتاح: {', '.join(drug['dosages'])}",
                    }

        return {
            "valid": False,
            "dosage": dosage,
            "warning": "لم يتم التعرف على الدواء للتحقق من التركيز",
        }

    def normalize_batch(self, medications: list[dict]) -> list[dict]:
        """
        Normalize a batch of medications from LLM output.

        Args:
            medications: List of {"name": str, "dosage": str, ...}

        Returns:
            List of normalized medications with match info
        """
        results = []
        for med in medications:
            name = med.get("name") or med.get("brand_name", "")
            dosage = med.get("dosage", "")

            # Normalize drug name
            match_result = self.normalize(name)

            # Verify dosage if drug was matched
            dosage_result = None
            if match_result["matched"] and dosage:
                dosage_result = self.normalize_dosage(
                    match_result["brand_name"], dosage
                )

            results.append({
                **med,
                "normalization": match_result,
                "dosage_verification": dosage_result,
                "normalized": match_result["matched"],
            })

        return results

    def _format_match(self, drug: dict, confidence: int, match_type: str) -> dict:
        """Format a successful match result."""
        return {
            "matched": True,
            "confidence": confidence,
            "match_type": match_type,
            "brand_name": drug["brand_name"],
            "generic_name": drug["generic_name"],
            "active_ingredients": drug["active_ingredients"],
            "available_dosages": drug["dosages"],
            "forms": drug["forms"],
            "category": drug["category"],
            "available_in_egypt": drug["available_in_egypt"],
        }

    def search(self, query: str, limit: int = 5) -> list[dict]:
        """Search drugs by name (for autocomplete)."""
        if not self._loaded:
            self.load()

        results = process.extract(
            query,
            self._brand_names + self._generic_names,
            scorer=fuzz.token_sort_ratio,
            limit=limit,
        )

        matches = []
        seen = set()
        for name, score, _ in results:
            # Find the drug
            for drug in self._drugs:
                if (drug["brand_name"] == name or drug["generic_name"] == name) and drug["brand_name"] not in seen:
                    seen.add(drug["brand_name"])
                    matches.append({
                        "brand_name": drug["brand_name"],
                        "generic_name": drug["generic_name"],
                        "score": score,
                    })
                    break

        return matches


# Singleton instance
drug_normalizer = DrugNormalizer()
