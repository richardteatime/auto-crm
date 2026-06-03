export interface AudioTranscriptionInput {
  audio: Blob;
  fileName: string;
  mimeType?: string | null;
  prompt?: string;
}

export interface AudioTranscriptionResult {
  text: string;
  model: string;
}

function getOpenAiApiKey(): string {
  return process.env.OPENAI_API_KEY || "";
}

function getTranscriptionModel(): string {
  return process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe";
}

function getTranscriptionLanguage(): string | null {
  const value = process.env.OPENAI_TRANSCRIPTION_LANGUAGE?.trim();
  return value || null;
}

export function isAudioTranscriptionConfigured(): boolean {
  return Boolean(getOpenAiApiKey());
}

export async function transcribeAudio(
  input: AudioTranscriptionInput,
): Promise<AudioTranscriptionResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY non configurata per la trascrizione audio");
  }

  const model = getTranscriptionModel();
  const form = new FormData();
  form.append("model", model);
  form.append(
    "file",
    new File([input.audio], input.fileName, {
      type: input.mimeType ?? (input.audio.type || "application/octet-stream"),
    }),
  );
  form.append(
    "prompt",
    input.prompt ??
      "Trascrivi comandi vocali CRM in italiano. Mantieni nomi propri, aziende, date, importi e numeri così come vengono detti.",
  );

  const language = getTranscriptionLanguage();
  if (language) {
    form.append("language", language);
  }

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const data = await res.json().catch(() => null) as {
    text?: string;
    error?: { message?: string };
  } | null;

  if (!res.ok) {
    throw new Error(
      data?.error?.message || `Trascrizione OpenAI fallita con status ${res.status}`,
    );
  }

  const text = data?.text?.trim() ?? "";
  if (!text) {
    throw new Error("Trascrizione audio vuota");
  }

  return { text, model };
}
