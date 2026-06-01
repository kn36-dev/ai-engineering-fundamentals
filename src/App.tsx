import { useState, useCallback, useRef, useEffect } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import Canvas from "./components/Canvas";
import ChatPanel from "./components/chat/ChatPanel";
import "./App.css";

import { useAgent } from 'agents/react'
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { CaptureUpdateAction, convertToExcalidrawElements, newElementWith } from "@excalidraw/excalidraw";

const sessionId = crypto.randomUUID()

export default function App() {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const appliedToolCalls = useRef(new Set())

  const handleApiReady = useCallback((api: ExcalidrawImperativeAPI) => {
    setExcalidrawAPI(api);
  }, []);

  const agent = useAgent({ agent: 'design-agent', name: sessionId })
  const { messages, sendMessage, status } = useAgentChat({ agent })

  // Inside App.tsx, right below your hooks:
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      console.log("🔍 [App.tsx] Full Messages Array:", messages);
      console.log("👉 [App.tsx] Latest Message Payload:", JSON.stringify(lastMessage, null, 2));
    }
  }, [messages]);

  useEffect(() => {
    if (!excalidrawAPI) return

    for (const message of messages) {
      if (message.role !== 'assistant') continue

      console.log("🛠️ [Diagram Loop] Processing Assistant Message parts:", message.parts);

      for (const part of message.parts ?? []) {
        console.log("📦 [Diagram Loop] Current Part Object:", part);

        if (part.type !== 'tool-generateDiagram' && part.type !== 'tool-modifyDiagram') {
          console.log(`❌ Skipped: type '${part.type}' is not a diagram tool`);
          continue;
        }

        if (part.state !== 'output-available') {
          console.log(`❌ Skipped: state is '${part.state}', expected 'output-available'`);
          continue
        }

        if (appliedToolCalls.current.has(part.toolCallId)) {
          console.log(`❌ Skipped: Tool Call ID ${part.toolCallId} already applied`);
          continue
        }

        console.log("🚀 SUCCESS: Executing canvas update for tool!", part);

        if (part.type === 'tool-generateDiagram') {
          appliedToolCalls.current.add(part.toolCallId)
          const output = part.output as { elements?: any }
          const skeletonElements = output.elements

          if (Array.isArray(skeletonElements) && skeletonElements.length > 0) {
            const elements = convertToExcalidrawElements(skeletonElements, { regenerateIds: false })
            excalidrawAPI.updateScene({ elements })
            excalidrawAPI.scrollToContent(elements, { fitToContent: true })
          }
        } else if (part.type === 'tool-modifyDiagram') {
          appliedToolCalls.current.add(part.toolCallId)
          const output = part.output as {
            elementId?: string
            updates?: Record<string, any>
          }
          if (output?.elementId && output.updates) {
            const current = excalidrawAPI.getSceneElements()
            const next = current.map(el =>
              (el.id === output.elementId ? newElementWith(el, output.updates as any) : el)
            )
            excalidrawAPI.updateScene({
              elements: next,
              captureUpdate: CaptureUpdateAction.IMMEDIATELY
            })
          }
        }

      }
    }
  }, [messages, excalidrawAPI])

  return (
    <div className={`app ${theme}`}>
      <div className="canvas-container">
        <Canvas onApiReady={handleApiReady} onThemeChange={setTheme} />
      </div>
      <ChatPanel messages={messages} sendMessage={sendMessage} status={status} />
    </div>
  );
}
