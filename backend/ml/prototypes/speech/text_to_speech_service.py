
import os
import tempfile

import gradio as gr
from faster_whisper import WhisperModel
from gtts import gTTS

# Chargement du modèle de transcription
print("Chargement du modèle Whisper...")
model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8"
)


def transcrire_audio(audio_path):
    """Convertit un fichier audio en texte."""
    if not audio_path:
        return "Enregistre ou importe un fichier audio."

    try:
        segments, info = model.transcribe(
            audio_path,
            language="fr",
            vad_filter=True
        )

        texte = " ".join(segment.text.strip() for segment in segments)

        if not texte:
            return "Aucune parole détectée."

        return texte

    except Exception as e:
        return f"Erreur de transcription : {e}"


def convertir_texte_audio(texte):
    """Convertit un texte en fichier audio."""
    if not texte or not texte.strip():
        raise gr.Error("Saisis un texte à convertir.")

    fichier = tempfile.NamedTemporaryFile(
        suffix=".mp3",
        delete=False
    )
    chemin_audio = fichier.name
    fichier.close()

    try:
        tts = gTTS(text=texte.strip(), lang="fr")
        tts.save(chemin_audio)
        return chemin_audio

    except Exception as e:
        if os.path.exists(chemin_audio):
            os.remove(chemin_audio)
        raise gr.Error(f"Erreur de synthèse vocale : {e}")


with gr.Blocks(title="Test Speech-to-Text / Text-to-Speech") as demo:
    gr.Markdown("# 🎙️ Service de conversion vocale")
    gr.Markdown("Prototype Python : voix vers texte et texte vers voix.")

    with gr.Tab("🎙️ Voix → Texte"):
        audio_input = gr.Audio(
            sources=["microphone", "upload"],
            type="filepath",
            label="Enregistre ta voix ou importe un audio"
        )

        bouton_transcrire = gr.Button("Transcrire", variant="primary")
        texte_transcrit = gr.Textbox(
            label="Texte obtenu",
            lines=5
        )

        bouton_transcrire.click(
            fn=transcrire_audio,
            inputs=audio_input,
            outputs=texte_transcrit
        )

    with gr.Tab("🔊 Texte → Voix"):
        texte_input = gr.Textbox(
            label="Texte à prononcer",
            placeholder="Bonjour, comment vas-tu ?",
            lines=4
        )

        bouton_generer = gr.Button("Générer la voix", variant="primary")
        audio_output = gr.Audio(label="Audio généré", type="filepath")

        bouton_generer.click(
            fn=convertir_texte_audio,
            inputs=texte_input,
            outputs=audio_output
        )


if __name__ == "__main__":
    demo.launch()
