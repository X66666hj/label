from __future__ import annotations

import argparse
import json
from pathlib import Path


def _iter_jsonl(path: Path):
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def _conversation_to_text(conv) -> str:
    if isinstance(conv, list):
        parts = []
        for msg in conv:
            if not isinstance(msg, dict):
                continue
            role = str(msg.get("role", "")).strip()
            content = str(msg.get("content", "")).strip()
            if role and content:
                parts.append(f"{role}: {content}")
            elif content:
                parts.append(content)
        return "\n".join(parts)
    return json.dumps(conv, ensure_ascii=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build a compact labeling dataset for the GitHub Pages annotator."
    )
    parser.add_argument(
        "--reco-dir",
        default="dataset/reco_by_category",
        help="Directory with top20_<Category>.jsonl outputs.",
    )
    parser.add_argument(
        "--chat-dir",
        default="dataset/chat/by_category",
        help="Directory with per-category conversations.",
    )
    parser.add_argument(
        "--out",
        default="docs/data.json",
        help="Output JSON for the annotator site.",
    )
    parser.add_argument(
        "--max-items",
        type=int,
        default=None,
        help="Optional max records to include (for quick demo).",
    )
    args = parser.parse_args()

    reco_dir = Path(args.reco_dir)
    chat_dir = Path(args.chat_dir)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    records = []
    total = 0
    for reco_path in sorted(reco_dir.glob("top20_*.jsonl")):
        category = reco_path.stem.replace("top20_", "")
        chat_path = chat_dir / f"{category}.jsonl"
        if not chat_path.exists():
            continue

        chat_rows = list(_iter_jsonl(chat_path))
        for idx, reco_row in enumerate(_iter_jsonl(reco_path), start=1):
            if idx > len(chat_rows):
                break
            convo = chat_rows[idx - 1].get("conversation", chat_rows[idx - 1])
            items = reco_row.get("llm_top20_items") or []
            cleaned_items = []
            for it in items:
                if not isinstance(it, dict):
                    continue
                cleaned_items.append(
                    {"id": it.get("id", ""), "title": it.get("title", "")}
                )
            record = {
                "id": f"{category}:{idx}",
                "category": category,
                "conversation_index": idx,
                "conversation": convo,
                "conversation_text": _conversation_to_text(convo),
                "items": cleaned_items,
            }
            records.append(record)
            total += 1
            if args.max_items is not None and total >= args.max_items:
                break
        if args.max_items is not None and total >= args.max_items:
            break

    with out_path.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)

    print(f"wrote {len(records)} records to {out_path}")


if __name__ == "__main__":
    main()
