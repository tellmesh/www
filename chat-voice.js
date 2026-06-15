/**
 * Voice capture, STT and TTS for Taskinity Chat.
 */
(function () {
  "use strict";

  function createVoiceController(deps) {
    let mediaRecorder = null;
    let mediaChunks = [];

    async function speakText(text) {
      if (!text?.trim()) return null;
      return deps.apiFetch("/api/voice/speak", {
        method: "POST",
        body: JSON.stringify({ text: text.trim().slice(0, 500), voice: "mock", play: true }),
      });
    }

    async function playSpeechResult(speech) {
      if (!speech) return;
      const playback = speech.playback;
      if (playback?.url) {
        try {
          const audio = new Audio(playback.url);
          await audio.play();
          return;
        } catch (_err) {
          // Fall through to speak API retry.
        }
      }
      if (speech.text) {
        await speakText(speech.text);
      }
    }

    function markdownToSpeechText(markdown) {
      return String(markdown || "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/[#>*_\[\]()]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 400);
    }

    async function maybeSpeakAssistantReply(markdown) {
      if (!deps.speakSummaryEl?.checked) return;
      const text = markdownToSpeechText(markdown);
      if (!text) return;
      try {
        await speakText(text);
      } catch (err) {
        console.warn("speak result failed", err);
      }
    }

    async function blobToBase64(blob) {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      return btoa(binary);
    }

    async function transcribeAudioBlob(blob, mimeType) {
      const engine = deps.voiceEngineEl?.value || "auto";
      const payload = { mime_type: mimeType, language: "pl" };
      if (engine === "mock") {
        payload.text = deps.promptEl.value.trim() || "otwórz Chrome i sprawdź health agenta";
        payload.engine = "mock";
      } else {
        payload.audio_base64 = await blobToBase64(blob);
        payload.engine = engine === "whisper" ? "auto" : engine;
      }
      return deps.apiFetch("/api/voice/transcribe", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    function showVoiceError(title, detail) {
      deps.appendMessage(
        "assistant",
        `<p><strong>${title}</strong></p><p>${deps.escapeHtml(String(detail))}</p>`,
        { error: true },
      );
    }

    async function submitTranscript(blob) {
      deps.setBusy(true);
      try {
        const result = await transcribeAudioBlob(blob, blob.type);
        const text = result.transcript?.text || "";
        if (!text) throw new Error("Empty transcript");
        deps.promptEl.value = text;
        deps.appendMessage("assistant", `<p>Transcript: ${deps.escapeHtml(text)}</p>`, { text });
        deps.form.requestSubmit();
      } catch (err) {
        showVoiceError("Voice error", err);
      } finally {
        deps.setBusy(false);
        mediaRecorder = null;
        mediaChunks = [];
      }
    }

    function bindRecorderStop(stream) {
      mediaRecorder.onstop = async () => {
        deps.micBtn?.classList.remove("is-recording");
        stream.getTracks().forEach((track) => track.stop());
        if (!mediaChunks.length) return;
        const blob = new Blob(mediaChunks, { type: mediaRecorder.mimeType || "audio/webm" });
        await submitTranscript(blob);
      };
    }

    async function startRecording() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size) mediaChunks.push(event.data);
      };
      bindRecorderStop(stream);
      mediaRecorder.start();
      deps.micBtn?.classList.add("is-recording");
    }

    async function toggleVoiceCapture() {
      if (deps.isBusy()) return;
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        showVoiceError("Voice unavailable", "Browser does not expose microphone APIs.");
        return;
      }
      try {
        await startRecording();
      } catch (err) {
        showVoiceError("Microphone blocked", err);
      }
    }

    return {
      speakText,
      playSpeechResult,
      maybeSpeakAssistantReply,
      toggleVoiceCapture,
    };
  }

  window.TaskinityChatVoice = { create: createVoiceController };
})();
