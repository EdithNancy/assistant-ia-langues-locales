"""Fine-tune NLLB-200 on a UTF-8 TSV with `source` and `target` columns.

Install optional dependencies with `pip install transformers datasets
sentencepiece accelerate torch`; keep the corpus and resulting model outside
Git. Use this only after validating the language codes and orthography.
"""
from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train", type=Path, required=True)
    parser.add_argument("--validation", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source-lang", required=True, help="NLLB tokenizer language code")
    parser.add_argument("--target-lang", required=True, help="NLLB tokenizer language code")
    parser.add_argument("--base-model", default="facebook/nllb-200-distilled-600M")
    parser.add_argument("--epochs", type=float, default=3)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    args = parser.parse_args()

    try:
        from datasets import load_dataset
        from transformers import (
            AutoModelForSeq2SeqLM,
            AutoTokenizer,
            DataCollatorForSeq2Seq,
            Seq2SeqTrainer,
            Seq2SeqTrainingArguments,
        )
    except ImportError as exc:
        raise SystemExit(
            "Dépendances facultatives absentes. Installez transformers, datasets, "
            "sentencepiece, accelerate et torch."
        ) from exc

    for path in (args.train, args.validation):
        if not path.is_file():
            raise SystemExit(f"Fichier de données introuvable: {path}")

    files = {"train": str(args.train), "validation": str(args.validation)}
    datasets = load_dataset("csv", data_files=files, delimiter="\t")
    required = {"source", "target"}
    for split in datasets:
        if not required.issubset(datasets[split].column_names):
            raise SystemExit("Chaque TSV doit avoir les colonnes `source` et `target`.")

    tokenizer = AutoTokenizer.from_pretrained(
        args.base_model,
        src_lang=args.source_lang,
        tgt_lang=args.target_lang,
    )
    model = AutoModelForSeq2SeqLM.from_pretrained(args.base_model)
    target_token_id = tokenizer.convert_tokens_to_ids(args.target_lang)

    def preprocess(batch):
        tokenizer.src_lang = args.source_lang
        tokenizer.tgt_lang = args.target_lang
        model_inputs = tokenizer(batch["source"], max_length=256, truncation=True)
        labels = tokenizer(text_target=batch["target"], max_length=256, truncation=True)
        model_inputs["labels"] = labels["input_ids"]
        return model_inputs

    tokenized = datasets.map(
        preprocess,
        batched=True,
        remove_columns=datasets["train"].column_names,
    )
    args.output.mkdir(parents=True, exist_ok=True)
    training_args = Seq2SeqTrainingArguments(
        output_dir=str(args.output),
        learning_rate=args.learning_rate,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        num_train_epochs=args.epochs,
        predict_with_generate=True,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        save_total_limit=2,
        report_to=[],
    )
    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["validation"],
        tokenizer=tokenizer,
        data_collator=DataCollatorForSeq2Seq(tokenizer, model=model),
    )
    trainer.train()
    trainer.save_model(str(args.output / "best"))
    tokenizer.save_pretrained(str(args.output / "best"))
    (args.output / "language_pair.txt").write_text(
        f"source={args.source_lang}\ntarget={args.target_lang}\n"
        f"forced_bos_token_id={target_token_id}\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
