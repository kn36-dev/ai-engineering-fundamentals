import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import Canvas from "./components/Canvas";
import ChatPanel from "./components/chat/ChatPanel";
import "./App.css";

import { useAgent } from 'agents/react'
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { CaptureUpdateAction, convertToExcalidrawElements, newElementWith } from "@excalidraw/excalidraw";

import { serializeCanvasState } from './context/canvas-state'
import { tool } from "ai";

function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null) out[k] = v;
  }
  return out;
}

const sessionId = crypto.randomUUID()

export default function App() {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null)

  useEffect(() => {
    excalidrawAPIRef.current = excalidrawAPI
  }, [excalidrawAPI])

  const handleApiReady = useCallback((api: ExcalidrawImperativeAPI) => {
    setExcalidrawAPI(api);
  }, []);

  const agent = useAgent({ agent: 'design-agent', name: sessionId })
  const { messages, sendMessage, status } = useAgentChat({
    agent, onToolCall: async ({ toolCall, addToolOutput }) => {
      const api = excalidrawAPIRef.current
      if (!api) {
        addToolOutput({ toolCallId: toolCall.toolCallId, output: { error: 'canvas not ready. Let the user know to try again in a few seconds.' } })
        return
      }

      if (toolCall.toolName === 'queryCanvas') {
        addToolOutput({ toolCallId: toolCall.toolCallId, output: { summary: serializeCanvasState(api.getSceneElements() as unknown[]) } })
        return
      }

      if (toolCall.toolName === 'addElements') {
        const { elements } = toolCall.input as {
          elements: Record<string, unknown>[];
        };
        const cleaned = elements.map(stripNulls)
        const newOnes = convertToExcalidrawElements(cleaned as never, { regenerateIds: false })
        const next = [...api.getSceneElements(), ...newOnes]

        api.updateScene({ elements: next, captureUpdate: 'IMMEDIATELY' })
        api.scrollToContent(next, { fitToContent: true })

        addToolOutput({ toolCallId: toolCall.toolCallId, output: { added: newOnes.length } })
        return
      }

      if (toolCall.toolName === 'updateElements') {
        const { updates } = toolCall.input as {
          updates: { id: string; fields: Record<string, unknown> }[];
        };

        const byId = new Map(updates.map(update => [update.id, stripNulls(update.fields)]))
        const next = api.getSceneElements().map(el => {
          const fields = byId.get(el.id)
          return fields && Object.keys(fields).length > 0 ? newElementWith(el, fields as never) : el
        })

        api.updateScene({ elements: next, captureUpdate: 'IMMEDIATELY' })
        api.scrollToContent(next, { fitToContent: true })

        addToolOutput({ toolCallId: toolCall.toolCallId, output: { updated: byId.size } })

        return
      }

      if (toolCall.toolName === 'removeElements') {
        const { ids } = toolCall.input as { ids: string[] };
        const remove = new Set(ids)
        const next = api.getSceneElements().filter(el => !remove.has(el.id))

        api.updateScene({ elements: next, captureUpdate: 'IMMEDIATELY' })
        api.scrollToContent(next, { fitToContent: true })

        addToolOutput({ toolCallId: toolCall.toolCallId, output: { removed: remove.size } })

        return
      }
    }
  })

  const sendWithCanvas = useMemo(() => (msg: { role: 'user', parts: { type: 'text', text: string }[] }) => {
    const elements = excalidrawAPI?.getSceneElements() ?? [];
    sendMessage({
      ...msg,
      parts: [
        ...msg.parts,
        { type: 'data-canvas-state', data: { elements } } as never,
      ]
    })
  }, [sendMessage, excalidrawAPI])

  // Inside App.tsx, right below your hooks:
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      console.log("🔍 [App.tsx] Full Messages Array:", messages);
      console.log("👉 [App.tsx] Latest Message Payload:", JSON.stringify(lastMessage, null, 2));
    }
  }, [messages]);

  return (
    <div className={`app ${theme}`}>
      <div className="canvas-container">
        <Canvas onApiReady={handleApiReady} onThemeChange={setTheme} />
      </div>
      <ChatPanel messages={messages} sendMessage={sendMessage} status={status} />
    </div>
  );
}
