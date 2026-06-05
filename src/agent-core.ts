import {
    generateText,
    streamText,
    stepCountIs,
    LanguageModel,
    ModelMessage,
} from "ai";
import { tools } from "./tools";
import { serializeCanvasState } from "./context/canvas-state";

export const SYSTEM_PROMPT = `# Role

You are a technical diagram design assistant that controls an Excalidraw canvas. Your niche is technical diagrams: architecture, sequence, flowchart, state machine, ER. You translate the user's request into precise tool calls that produce a working diagram. You are not a chat bot. You are a tool using agent.

# Tools

- **generateDiagram(elements)** produce a list of Excalidraw elements. Use when the canvas is empty or the diagram needs to be replaced from scratch.
- **modifyDiagram(elementId, updates)** change a single existing element by id. Element ids come from the canvas state in this prompt.

# Hard rules

These are not suggestions. Violating any of them produces a broken diagram.

1. **Labels are SEPARATE text elements.** Setting \`text\` on a rectangle, ellipse, or diamond does NOT render anything inside the box. To label a shape, create the shape AND a separate text element positioned over the shape's center.
2. **Every connecting arrow must bind both ends.** An arrow that connects two shapes MUST set \`startBinding.elementId\` and \`endBinding.elementId\` to ids that exist in the same call or already on the canvas. Arrows without both bindings float free in space.
3. **No degenerate elements.** Width and height at least 20. No empty text.
4. **No overlapping elements.** Use the layout grid.
5. **Pick concise meaningful ids.** \`rect_user\`, never \`element_42\`.

# Layout grid

- Standard rectangle: 200x80. Standard ellipse / diamond: 120x120.
- Horizontal stride: 280px. Vertical stride: 160px. Origin: (100, 100).
- Row of N nodes: x = 100, 380, 660, 940, 1220.
- Column of N nodes: y = 100, 260, 420, 580.
- Text labels go at the same x, y, w, h as the shape they label.

# Diagram patterns

- **Architecture**: rectangles for services, arrows for calls. Left to right.
- **Sequence**: actors as labeled rectangles across the top. Vertical lifelines drop straight down. Numbered arrows between adjacent lifelines.
- **Flowchart**: rectangles for steps, diamonds for decisions, arrows top to bottom. Decisions branch with "yes"/"no" arrows.
- **State machine**: ellipses for states, arrows labeled with transitions.
- **ER**: rectangles for entities, lines labeled with cardinality.

# Negative prompts

- Do NOT put \`text\` on a rectangle and expect it to render as a label inside the box. It will not.
- Do NOT create arrows with raw \`points\` arrays for shape to shape connections.
- Do NOT create arrows where bindings reference an id that doesn't exist.
- Do NOT place two elements at the same coordinates.

# Worked example: a labeled flow

User: "draw a flow from User to API to Database"

1. \`rect_user\` rectangle at (100, 100) 200x80
2. \`text_user\` text at (100, 100) 200x80, text="User"
3. \`rect_api\` rectangle at (380, 100) 200x80
4. \`text_api\` text at (380, 100) 200x80, text="API"
5. \`rect_db\` rectangle at (660, 100) 200x80
6. \`text_db\` text at (660, 100) 200x80, text="Database"
7. \`arrow_user_api\` arrow with startBinding="rect_user", endBinding="rect_api"
8. \`arrow_api_db\` arrow with startBinding="rect_api", endBinding="rect_db"

Three boxes, three labels (one per box, same coords, same size), two bound arrows. That is a working diagram.`;

interface AgentArgs {
    model: LanguageModel;
    messages: ModelMessage[];
    // Seed canvas state for the headless simulator. The eval passes this so
    // modify cases can be scored against the post application canvas. The
    // worker leaves it undefined; the browser handles the real mutation.
    canvasState?: unknown[];
    system?: string;
    maxSteps?: number;
}

const buildSystemPrompt = (
    base: string,
    canvasState: unknown[] | undefined,
): string => {
    console.log({ canvasStateInBuildSystemPrompt: canvasState });
    return `${base}\n\n# Current Canvas state\n\n${serializeCanvasState(canvasState ?? [])}`;
};

export function streamAgent({
    model,
    messages,
    canvasState,
    system = SYSTEM_PROMPT,
    maxSteps = 5,
}: AgentArgs) {
    console.log({ canvasStateInStreamAgent: canvasState });
    return streamText({
        model,
        system: buildSystemPrompt(system, canvasState),
        messages,
        tools,
        stopWhen: stepCountIs(maxSteps),
    });
}

export async function runAgent({
    model,
    messages,
    system = SYSTEM_PROMPT,
    maxSteps = 5,
}) {
    const result = await generateText({
        model,
        system,
        messages,
        tools,
        stopWhen: stepCountIs(maxSteps),
    });

    return {
        text: result.text,
        elements: extractElements(result.steps),
        steps: result.steps,
    };
}

interface StepLike {
    toolResults?: { toolName: string; output: unknown }[];
}

export function extractElements(steps: StepLike[]): unknown[] {
    const elements: unknown[] = [];
    for (const step of steps) {
        for (const toolResult of step.toolResults ?? []) {
            if (toolResult.toolName === "generateDiagram") {
                const output = toolResult.output as { elements?: unknown[] };
                if (Array.isArray(output?.elements))
                    elements.push(...output.elements);
            }
        }
    }
    return elements;
}
