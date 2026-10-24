"""Translate one line or a UTF-8 text file with a fine-tuned NLLB checkpoint."""
from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--source-lang", required=True)
    parser.add_argument("--target-lang", required=True)
    parser.add_argument("--text")
    parser.add_argument("--input", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if bool(args.text) == bool(args.input):
        parser.error("Fournissez exactement l'un de --text ou --input.")
    if args.input and not args.input.is_file():
        parser.error(f"Fichier introuvable: {args.input}")
    if args.output and not args.input:
        parser.error("--output s'utilise avec --input.")
    if not args.model.is_dir():
        parser.error(f"Checkpoint introuvable: {args.model}")

    try:
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    except ImportError as exc:
        raise SystemExit(
            "Dépendances facultatives absentes. Installez transformers, "
            "sentencepiece et torch."
        ) from exc

    tokenizer = AutoTokenizer.from_pretrained(
        args.model, src_lang=args.source_lang, tgt_lang=args.target_lang
    )
    model = AutoModelForSeq2SeqLM.from_pretrained(args.model)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    target_token_id = tokenizer.convert_tokens_to_ids(args.target_lang)
    if target_token_id == tokenizer.unk_token_id:
        parser.error(f"Code NLLB inconnu du tokenizer: {args.target_lang}")

    lines = (
        args.input.read_text(encoding="utf-8").splitlines()
        if args.input
        else [args.text]
    )
    results = []
    for line in lines:
        if not line.strip():
            results.append("")
            continue
        tokens = tokenizer(line, return_tensors="pt", truncation=True, max_length=512)
        tokens = {key: value.to(device) for key, value in tokens.items()}
        generated = model.generate(
            **tokens,
            forced_bos_token_id=target_token_id,
            max_new_tokens=256,
        )
        results.append(tokenizer.batch_decode(generated, skip_special_tokens=True)[0])

    output = "\n".join(results)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output + "\n", encoding="utf-8")
    else:
        print(output)


if __name__ == "__main__":
    main()
