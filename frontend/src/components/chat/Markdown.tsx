import { Fragment } from "react";

/**
 * Tiny markdown renderer for agent replies: **bold**, `code`, bullet lists and
 * line breaks. Builds React nodes (never raw HTML), so replies can't inject markup.
 */
function inline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={key} className="rounded bg-black/5 px-1 py-0.5 text-[0.92em]" dir="ltr">{part.slice(1, -1)}</code>;
    return <Fragment key={key}>{part.replace(/\*\*/g, "")}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    const items = list;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-1 list-disc space-y-0.5 ps-5">
        {items.map((item, i) => <li key={i}>{inline(item, `li-${blocks.length}-${i}`)}</li>)}
      </ul>
    );
    list = [];
  };

  text.split("\n").forEach((rawLine, i) => {
    const line = rawLine.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flushList();
    if (!line.trim()) {
      blocks.push(<div key={`sp-${i}`} className="h-2" />);
      return;
    }
    blocks.push(<p key={`p-${i}`}>{inline(line.replace(/^#+\s*/, ""), `p-${i}`)}</p>);
  });
  flushList();

  return <div className="space-y-0.5">{blocks}</div>;
}
