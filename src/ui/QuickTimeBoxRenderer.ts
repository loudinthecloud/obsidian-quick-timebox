import {
	App,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	MarkdownView,
} from "obsidian";
import { resolveEndMinutes, TimePlanData } from "../types";

function parseTimeToMinutes(str: string): number {
	const parts = str.split(":");
	const h = parseInt(parts[0] ?? "0") || 0;
	const m = parseInt(parts[1] ?? "0") || 0;
	return h * 60 + m;
}

function minutesToTimeStr(totalMinutes: number): string {
	const h = Math.floor(totalMinutes / 60);
	const m = totalMinutes % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function granularityLabel(g: number): string {
	if (g >= 60 && g % 60 === 0) return `${g / 60}h`;
	return `${g}min`;
}

export class QuickTimeBoxView extends MarkdownRenderChild {
	private data: TimePlanData;
	private ctx: MarkdownPostProcessorContext;
	private app: App;
	private saveTimeout: number | null = null;

	private showNowLine = true;
	private nowLine: HTMLElement | null = null;
	private grid: HTMLElement | null = null;
	private startMin = 0;
	private endMin = 0;
	private rawEndMin = 0;

	constructor(
		containerEl: HTMLElement,
		data: TimePlanData,
		ctx: MarkdownPostProcessorContext,
		app: App,
	) {
		super(containerEl);
		this.data = { ...data, entries: { ...(data.entries ?? {}) } };
		this.showNowLine = data.showNow !== false;
		this.ctx = ctx;
		this.app = app;
	}

	onload() {
		this.build();
		// Update the now-line every minute
		this.registerInterval(
			window.setInterval(() => this.updateNowLine(), 60_000),
		);
	}

	onunload() {
		if (this.saveTimeout !== null) {
			window.clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
		}
	}

	private build() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("quicktimebox-container");

		const isRtl =
			this.data.rtl === true ||
			window.getComputedStyle(containerEl).direction === "rtl";
		if (isRtl) containerEl.addClass("quicktimebox-rtl");

		this.startMin = parseTimeToMinutes(this.data.startTime);
		this.rawEndMin = parseTimeToMinutes(this.data.endTime);
		this.endMin = resolveEndMinutes(this.startMin, this.rawEndMin);

		if (
			isNaN(this.startMin) ||
			isNaN(this.rawEndMin) ||
			this.startMin === this.rawEndMin
		) {
			containerEl.createEl("p", {
				text: "Invalid time range.",
				cls: "quicktimebox-error",
			});
			return;
		}

		// ── Header: [range] [duration] [now]  ───────────────────
		const header = containerEl.createDiv({ cls: "quicktimebox-header" });

		header.createSpan({
			text: `${this.data.startTime} – ${this.data.endTime}`,
			cls: "quicktimebox-header-range",
		});
		header.createSpan({
			text: granularityLabel(this.data.granularity),
			cls: "quicktimebox-header-gran",
		});

		const nowToggle = header.createEl("button", {
			cls: "quicktimebox-now-toggle quicktimebox-now-toggle--on",
			attr: { "aria-label": "Toggle current time marker" },
		});
		nowToggle.createEl("span", { cls: "quicktimebox-now-toggle-dot" });
		nowToggle.createEl("span", {
			text: "Now",
			cls: "quicktimebox-now-toggle-label",
		});
		nowToggle.toggleClass("quicktimebox-now-toggle--on", this.showNowLine);
		nowToggle.addEventListener("click", () => {
			this.showNowLine = !this.showNowLine;
			this.data.showNow = this.showNowLine;
			nowToggle.toggleClass(
				"quicktimebox-now-toggle--on",
				this.showNowLine,
			);
			this.updateNowLine();
			this.save();
		});

		// ── Grid ────────────────────────────────────────────────
		this.grid = containerEl.createDiv({ cls: "quicktimebox-grid" });

		const scheduleSave = () => {
			if (this.saveTimeout !== null)
				window.clearTimeout(this.saveTimeout);
			this.saveTimeout = window.setTimeout(() => {
				if (!containerEl.contains(document.activeElement)) this.save();
			}, 1500);
		};

		for (
			let t = this.startMin;
			t < this.endMin;
			t += this.data.granularity
		) {
			const timeStr = minutesToTimeStr(t);
			const isHour = t % 60 === 0;

			const row = this.grid.createDiv({
				cls: `quicktimebox-row${isHour ? " quicktimebox-row--hour" : ""}`,
			});
			row.createDiv({ cls: "quicktimebox-label", text: timeStr });

			const textarea = row.createEl("textarea", {
				cls: "quicktimebox-entry",
			});
			textarea.value = this.data.entries[timeStr] ?? "";
			textarea.rows = 1;

			const resize = () => {
				textarea.setCssProps({ "--quicktimebox-entry-height": "auto" });
				textarea.setCssProps({
					"--quicktimebox-entry-height": `${textarea.scrollHeight}px`,
				});
			};
			textarea.addEventListener("input", () => {
				resize();
				this.data.entries[timeStr] = textarea.value;
				scheduleSave();
			});
			requestAnimationFrame(resize);
		}

		// Now line element (absolutely positioned inside grid)
		this.nowLine = this.grid.createDiv({ cls: "quicktimebox-now-line" });

		containerEl.addEventListener("focusout", (e: FocusEvent) => {
			if (!containerEl.contains(e.relatedTarget as Node | null)) {
				if (this.saveTimeout !== null) {
					window.clearTimeout(this.saveTimeout);
					this.saveTimeout = null;
				}
				this.save();
			}
		});

		// Position now-line after layout has been painted
		requestAnimationFrame(() => this.updateNowLine());
	}

	private updateNowLine() {
		if (!this.nowLine || !this.grid) return;

		if (!this.showNowLine) {
			this.nowLine.addClass("quicktimebox-now-line--hidden");
			return;
		}

		const now = new Date();
		let currentMin = now.getHours() * 60 + now.getMinutes();

		// Handle midnight-wrap ranges (e.g. 22:00–03:00)
		if (this.rawEndMin <= this.startMin && currentMin < this.startMin) {
			currentMin += 1440;
		}

		if (currentMin < this.startMin || currentMin >= this.endMin) {
			this.nowLine.addClass("quicktimebox-now-line--hidden");
			return;
		}

		this.nowLine.removeClass("quicktimebox-now-line--hidden");

		const rows =
			this.grid.querySelectorAll<HTMLElement>(".quicktimebox-row");
		const slotIndex = Math.floor(
			(currentMin - this.startMin) / this.data.granularity,
		);
		const fraction =
			((currentMin - this.startMin) % this.data.granularity) /
			this.data.granularity;

		if (slotIndex >= rows.length) {
			this.nowLine.addClass("quicktimebox-now-line--hidden");
			return;
		}

		const row = rows[slotIndex] as HTMLElement | undefined;
		const nextRow = rows[slotIndex + 1] as HTMLElement | undefined;
		if (!row) {
			this.nowLine.addClass("quicktimebox-now-line--hidden");
			return;
		}
		let top: number;

		if (nextRow) {
			top =
				row.offsetTop + (nextRow.offsetTop - row.offsetTop) * fraction;
		} else {
			top = row.offsetTop + row.offsetHeight * fraction;
		}

		this.nowLine.style.top = `${top}px`;
	}

	private save() {
		const info = this.ctx.getSectionInfo(this.containerEl);
		if (!info) return;

		const markdownView =
			this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView) return;

		const editor = markdownView.editor;
		const newJson = JSON.stringify(this.data, null, 2);

		const contentLineEnd = info.lineEnd - 1;
		if (contentLineEnd < info.lineStart + 1) return;

		editor.replaceRange(
			newJson,
			{ line: info.lineStart + 1, ch: 0 },
			{ line: contentLineEnd, ch: editor.getLine(contentLineEnd).length },
		);
	}
}
