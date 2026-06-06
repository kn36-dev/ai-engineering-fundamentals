import { useState, useCallback, useEffect, useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  convertToExcalidrawElements,
  CaptureUpdateAction,
  newElementWith,
} from "@excalidraw/excalidraw";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import Canvas from "./components/Canvas";
import ChatPanel from "./components/chat/ChatPanel";
import { serializeCanvasState } from "./context/canvas-state";
import "./App.css";

// One agent instance per page load. The canvas state lives only in the
// browser, so persisting chat history across refreshes would leave a dead
// conversation referencing diagrams that no longer exist.
const sessionId = crypto.randomUUID();
const AGENT_CONFIG = { agent: "design-agent", name: sessionId };

// Drop null valued fields. Our tool schemas use nullable rather than
// optional so OpenAI strict mode stays on, which means the agent always
// sends every field. Excalidraw expects undefined for "use the default,"
// not null, and choking on `points: null` for a rectangle is a real bug.
function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null) out[k] = v;
  }
  return out;
}

export default function App() {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Hold the latest excalidrawAPI in a ref so onToolCall (captured once at
  // hook init) always reads the live API instead of a stale closure copy.
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  useEffect(() => {
    excalidrawAPIRef.current = excalidrawAPI;
  }, [excalidrawAPI]);

  const handleApiReady = useCallback((api: ExcalidrawImperativeAPI) => {
    setExcalidrawAPI(api);
  }, []);

  const agent = useAgent(AGENT_CONFIG);

  const handleToolCall = useCallback(async ({ toolCall, addToolOutput }: any) => {
    {
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
  }, []); // Empty dependencies mean this reference stays permanently unique

  // All four canvas tools are client side. The worker streams the call here,
  // we apply it to the live Excalidraw scene, and submit the result via
  // addToolOutput so the agent loop resumes.
  const { messages, sendMessage, status } = useAgentChat({
    agent,
    onToolCall: handleToolCall
  });

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
      <ChatPanel
        messages={messages}
        sendMessage={sendMessage}
        status={status}
      />
      <a href="#viewer" className="viewer-launch" title="Open diagram viewer for human scoring">
        viewer
      </a>
    </div>
  );
}
