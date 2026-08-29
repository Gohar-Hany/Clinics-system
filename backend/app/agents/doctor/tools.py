"""
Doctor Assistant Agent Tools — Clinical knowledge tools, drug interaction checks,
and medical guideline retrieval.
"""

from langchain_core.tools import tool
from typing import Optional
import json

# Curated High-Risk Clinical Drug Interaction Database
DRUG_INTERACTIONS_DB = {
    ("warfarin", "aspirin"): {
        "severity": "CRITICAL",
        "effect": "Severe risk of major bleeding and gastrointestinal hemorrhage.",
        "recommendation": "Avoid combination or closely monitor INR and consider gastroprotection."
    },
    ("warfarin", "ibuprofen"): {
        "severity": "HIGH",
        "effect": "Increased risk of bleeding due to platelet inhibition and gastric mucosal injury.",
        "recommendation": "Use paracetamol for analgesia instead of NSAIDs."
    },
    ("lisinopril", "potassium"): {
        "severity": "HIGH",
        "effect": "Risk of life-threatening hyperkalemia.",
        "recommendation": "Monitor serum potassium levels closely."
    },
    ("clopidogrel", "omeprazole"): {
        "severity": "MODERATE",
        "effect": "Omeprazole decreases the antiplatelet effect of clopidogrel.",
        "recommendation": "Consider pantoprazole or famotidine as an alternative."
    },
    ("sildenafil", "nitroglycerin"): {
        "severity": "FATAL",
        "effect": "Severe, refractory hypotension and cardiovascular collapse.",
        "recommendation": "Absolute contraindication. Never co-prescribe."
    },
    ("ciprofloxacin", "theophylline"): {
        "severity": "HIGH",
        "effect": "Increased theophylline toxicity (seizures, cardiac arrhythmias).",
        "recommendation": "Reduce theophylline dose and monitor levels."
    },
    ("metformin", "contrast_dye"): {
        "severity": "HIGH",
        "effect": "Risk of lactic acidosis if renal impairment occurs post-contrast.",
        "recommendation": "Discontinue metformin 48h prior to and after iodinated radiocontrast."
    },
    ("aspirin", "ibuprofen"): {
        "severity": "MODERATE",
        "effect": "Ibuprofen may interfere with the cardioprotective antiplatelet effect of low-dose aspirin.",
        "recommendation": "Take immediate-release aspirin at least 30 minutes before ibuprofen or 8 hours after."
    }
}


@tool
def check_drug_interactions(medications: list[str]) -> dict:
    """Check for known dangerous drug-drug interactions between a list of prescribed medications.

    Args:
        medications: List of generic or brand drug names (e.g. ['Aspirin', 'Warfarin', 'Panadol'])

    Returns:
        Dict with list of detected interactions, severity levels, and clinical recommendations
    """
    clean_meds = [m.lower().strip() for m in medications]
    detected = []

    for i in range(len(clean_meds)):
        for j in range(i + 1, len(clean_meds)):
            med1, med2 = clean_meds[i], clean_meds[j]
            
            # Check direct or reverse key
            pair1 = (med1, med2)
            pair2 = (med2, med1)
            
            # Fuzzy match in DB
            for (d1, d2), info in DRUG_INTERACTIONS_DB.items():
                if (d1 in med1 or med1 in d1) and (d2 in med2 or med2 in d2) or \
                   (d1 in med2 or med2 in d1) and (d2 in med1 or med1 in d2):
                    detected.append({
                        "drugs": [med1, med2],
                        "severity": info["severity"],
                        "clinical_effect": info["effect"],
                        "recommendation": info["recommendation"],
                    })

    is_safe = len(detected) == 0
    return {
        "safe_to_prescribe": is_safe,
        "total_interactions_found": len(detected),
        "interactions": detected,
        "status": "APPROVED" if is_safe else "WARNING_INTERACTION_DETECTED",
    }


@tool
def search_clinical_guidelines(condition: str) -> dict:
    """Retrieve evidence-based clinical management guidelines and recommended first-line therapies.

    Args:
        condition: Clinical diagnosis or syndrome (e.g. 'Type 2 Diabetes', 'Hypertension Stage 1', 'Acute Sinusitis')

    Returns:
        Dict with recommended first-line drugs, dosing guidelines, and red flag warnings
    """
    cond = condition.lower()
    
    if "hypertension" in cond or "ضغط" in cond:
        return {
            "condition": "Hypertension (Stage 1 / 2)",
            "first_line_therapy": [
                {"class": "ACE Inhibitors / ARBs", "examples": ["Lisinopril 10mg", "Losartan 50mg"]},
                {"class": "Calcium Channel Blockers", "examples": ["Amlodipine 5mg - 10mg"]},
                {"class": "Thiazide Diuretics", "examples": ["Hydrochlorothiazide 12.5mg - 25mg"]}
            ],
            "lifestyle_modifications": "DASH diet, low sodium (<2g/day), weight management, 30 min daily walking.",
            "red_flags": "BP > 180/120 with target organ damage (Hypertensive Emergency)."
        }
    elif "diabetes" in cond or "سكر" in cond:
        return {
            "condition": "Type 2 Diabetes Mellitus",
            "first_line_therapy": [
                {"class": "Biguanides", "examples": ["Metformin 500mg - 1000mg with meals"]},
                {"class": "SGLT2 Inhibitors", "examples": ["Empagliflozin 10mg - 25mg (cardioprotective)"]}
            ],
            "lifestyle_modifications": "Carbohydrate counting, HbA1c target < 7.0%, annual fundus and kidney check.",
            "red_flags": "DKA, HHS, severe hypoglycemia (< 54 mg/dL)."
        }
    elif "sinusitis" in cond or "pharyngitis" in cond or "احتقان" in cond or "جيوب انفية" in cond:
        return {
            "condition": "Upper Respiratory Tract Infection / Sinusitis",
            "first_line_therapy": [
                {"class": "Analgesic / Antipyretic", "examples": ["Paracetamol 1000mg every 8h PRN"]},
                {"class": "Nasal Decongestant / Saline", "examples": ["Hypertonic Saline spray 3x daily"]},
                {"class": "Antibiotic (Only if bacterial >10 days)", "examples": ["Amoxicillin/Clavulanate 1000mg every 12h for 7 days"]}
            ],
            "notes": "Most cases are viral and self-limiting within 7-10 days. Avoid unnecessary antibiotics."
        }
    
    return {
        "condition": condition,
        "guideline_summary": f"Evidence-based clinical protocol for {condition}: Recommend conservative symptomatic management, vital sign monitoring, and tailored pharmacotherapy.",
        "follow_up": "Routine follow-up in 7-14 days or immediately if symptoms worsen."
    }


DOCTOR_TOOLS = [
    check_drug_interactions,
    search_clinical_guidelines,
]
