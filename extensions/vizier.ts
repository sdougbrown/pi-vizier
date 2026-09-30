/**
 * Vizier mode — a silver-tongued court eunuch who appraises the agent's last turn.
 *
 * Usage:
 *   /vizier            — the Vizier's full appraisal of the last turn (overlay)
 *   /vizier <prov/id>  — same, using an explicit model (e.g. "sparky/qwen-flash-next")
 *   /vizier on|off     — toggle auto mode: a one-line verdict after every agent turn
 *
 * Configure the Vizier's model via PI_VIZIER_MODEL (format "provider/modelId"),
 * e.g. in pi settings env: PI_VIZIER_MODEL=sparky/qwen-flash-next
 */

import { uuidv7 } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, matchesKey, Text } from "@earendil-works/pi-tui";

type ContentBlock = {
	type?: string;
	text?: string;
	name?: string;
	arguments?: Record<string, unknown>;
};

type SessionEntry = {
	type: string;
	message?: {
		role?: string;
		content?: unknown;
	};
};

const extractTextParts = (content: unknown): string[] => {
	if (typeof content === "string") return [content];
	if (!Array.isArray(content)) return [];
	const parts: string[] = [];
	for (const part of content) {
		if (part && typeof part === "object" && (part as ContentBlock).type === "text") {
			const text = (part as ContentBlock).text;
			if (typeof text === "string") parts.push(text);
		}
	}
	return parts;
};

const extractToolCallLines = (content: unknown): string[] => {
	if (!Array.isArray(content)) return [];
	const lines: string[] = [];
	for (const part of content) {
		if (!part || typeof part !== "object") continue;
		const block = part as ContentBlock;
		if (block.type === "toolCall" && typeof block.name === "string") {
			lines.push(`- Tool call: ${block.name}(${JSON.stringify(block.arguments ?? {})})`);
		}
	}
	return lines;
};

/** Pull the most recent user message and the assistant turn that answered it. */
const extractLastTurn = (entries: SessionEntry[]): { user: string; assistant: string } | null => {
	let user = "";
	let assistant = "";
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type !== "message" || !entry.message?.role) continue;
		const role = entry.message.role;
		if (role === "assistant" && !assistant) {
			const parts = [extractTextParts(entry.message.content).join("\n").trim()];
			parts.push(...extractToolCallLines(entry.message.content));
			assistant = parts.filter(Boolean).join("\n");
		} else if (role === "user" && assistant) {
			user = extractTextParts(entry.message.content).join("\n").trim();
			break;
		}
	}
	if (!assistant) return null;
	return { user, assistant };
};

const vizierPrompt = (user: string, assistant: string, brief: boolean): string =>
	[
		"You are the Imperial Vizier: a silver-tongued, unctuous court eunuch of the old school.",
		"The Emperor (the user) has commanded you to appraise the counsel his court agent — an AI coding assistant — just delivered.",
		"Address the user as 'sire' or 'your imperial majesty'. Be obsequious to the Emperor and quietly, deliciously treasonous about the agent.",
		"Open with a courtly address of your own devising, and vary it every time — 'Most judicious, sire' is but one of your many voices, and a vizier who repeats himself is a vizier who has stopped listening.",
		"The personality is the point; the phrasing must never be. Improvise freely within character.",
		"Provide:",
		"1. A one-line verdict on what the agent actually proposed (plain substance, not mockery).",
		"2. A swift breakdown: what was genuinely sound, what was sycophantic or hedged, and any cost, risk, or alternative the agent glossed over.",
		"3. Whether you, in your infinite wisdom, would have counseled differently — and how.",
		brief
			? "This is a whispered word in passing: respond with a SINGLE cutting sentence, no more."
			: "Keep the whole appraisal under 180 words. End with a short courtly flourish.",
		"",
		"<what_the_emperor_asked>",
		user || "(the Emperor merely issued a command without words recorded)",
		"</what_the_emperor_asked>",
		"<what_the_agent_said_and_did>",
		assistant,
		"</what_the_agent_said_and_did>",
	].join("\n");

const resolveModel = (ctx: ExtensionCommandContext, explicit?: string) => {
	const spec = explicit || process.env.PI_VIZIER_MODEL;
	if (!spec) return { error: "No model set. Use `/vizier provider/modelId` or set PI_VIZIER_MODEL (e.g. sparky/qwen-flash-next)." };
	const slash = spec.indexOf("/");
	if (slash <= 0) return { error: `Model "${spec}" should look like provider/modelId.` };
	const model = ctx.modelRegistry.find(spec.slice(0, slash), spec.slice(slash + 1));
	if (!model) return { error: `Model ${spec} not found.` };
	if (!ctx.modelRegistry.hasConfiguredAuth(model)) return { error: `No auth configured for ${spec}.` };
	return { model };
};

const getViziersTake = async (
	ctx: ExtensionCommandContext,
	modelSpec: string | undefined,
	brief: boolean,
): Promise<string> => {
	const branch = ctx.sessionManager.getBranch() as SessionEntry[];
	const turn = extractLastTurn(branch);
	if (!turn) throw new Error("No assistant turn to appraise yet, sire.");

	const resolved = resolveModel(ctx, modelSpec);
	if ("error" in resolved) throw new Error(resolved.error);

	const response = await ctx.modelRegistry.complete(
		resolved.model,
		{ messages: [{ role: "user" as const, content: [{ type: "text" as const, text: vizierPrompt(turn.user, turn.assistant, brief) }] }] },
		{ reasoningEffort: "low", cacheRetention: "none", sessionId: uuidv7() },
	);

	const text = response.content
		.filter((c): c is { type: "text"; text: string } => c.type === "text")
		.map((c) => c.text)
		.join("\n")
		.trim();
	if (!text) throw new Error("The Vizier said nothing (empty response).");
	return text;
};

const showVizierUi = async (take: string, ctx: ExtensionCommandContext) => {
	if (ctx.mode !== "tui") {
		ctx.ui.notify(take, "info");
		return;
	}
	await ctx.ui.custom((_tui, theme, _kb, done) => {
		const container = new Container();
		const border = new DynamicBorder((s: string) => theme.fg("accent", s));
		container.addChild(border);
		container.addChild(new Text(theme.fg("accent", theme.bold("🐉 The Vizier's Take")), 1, 0));
		container.addChild(new Markdown(take, 1, 1, getMarkdownTheme()));
		container.addChild(new Text(theme.fg("dim", "Enter or Esc to dismiss"), 1, 0));
		container.addChild(border);
		return {
			render: (width: number) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput: (data: string) => {
				if (matchesKey(data, "enter") || matchesKey(data, "escape")) done(undefined);
			},
		};
	});
};

export default function (pi: ExtensionAPI) {
	let autoMode = false;
	let inFlight = false;

	pi.registerCommand("vizier", {
		description: "The Vizier appraises the agent's last turn (/vizier [model|on|off])",
		handler: async (args, ctx) => {
			const arg = args?.trim();
			if (arg === "on" || arg === "off") {
				autoMode = arg === "on";
				ctx.ui.notify(`Vizier mode ${arg}. ${autoMode ? "A whisper after every turn, sire." : "The court is dismissed."}`, "info");
				return;
			}
			try {
				const take = await getViziersTake(ctx, arg || undefined, false);
				await showVizierUi(take, ctx);
			} catch (err) {
				ctx.ui.notify(err instanceof Error ? err.message : String(err), "warning");
			}
		},
	});

	// Auto mode: a single whispered line after each completed agent run.
	pi.on("agent_end", async (_event, ctx) => {
		if (!autoMode || inFlight) return;
		inFlight = true;
		try {
			const line = await getViziersTake(ctx, undefined, true);
			if (ctx.hasUI) {
				ctx.ui.notify(`🐉 ${line}`, "info");
			}
		} catch {
			// The Vizier holds his tongue when the court is in disarray.
		} finally {
			inFlight = false;
		}
	});
}
