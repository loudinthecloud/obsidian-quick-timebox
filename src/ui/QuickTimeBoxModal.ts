import { App, Editor, Modal, Notice, Setting } from "obsidian";
import {
	DEFAULT_TIME_PLAN,
	GRANULARITY_OPTIONS,
	resolveEndMinutes,
	TimePlanData,
} from "../types";

function parseTimeToMinutes(val: string): number | null {
	const match = val.trim().match(/^(\d{1,3}):([0-5]\d)$/);
	if (!match || !match[1] || !match[2]) return null;
	return parseInt(match[1]) * 60 + parseInt(match[2]);
}

export class QuickTimeBoxModal extends Modal {
	private editor: Editor;
	private startTime = DEFAULT_TIME_PLAN.startTime;
	private endTime = DEFAULT_TIME_PLAN.endTime;
	private granularity = DEFAULT_TIME_PLAN.granularity;
	private rtl = false;

	constructor(app: App, editor: Editor) {
		super(app);
		this.editor = editor;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("quicktimebox-create-modal");
		this.titleEl.setText("Create timeboxing");

		let slotCountEl: HTMLElement;

		const updatePreview = () => {
			const s = parseTimeToMinutes(this.startTime);
			const e = parseTimeToMinutes(this.endTime);
			if (s === null || e === null) {
				slotCountEl.setText("Invalid time format");
				slotCountEl.removeClass("quicktimebox-modal-preview--ok");
				slotCountEl.addClass("quicktimebox-modal-preview--error");
				return;
			}
			const resolvedEnd = resolveEndMinutes(s, e);
			const count = Math.floor((resolvedEnd - s) / this.granularity);
			const wraps = e <= s;
			const label = wraps
				? `${count} slots (ends next day)`
				: `${count} time slots`;
			slotCountEl.setText(label);
			slotCountEl.removeClass("quicktimebox-modal-preview--error");
			slotCountEl.addClass("quicktimebox-modal-preview--ok");
		};

		new Setting(contentEl)
			.setName("Start time")
			.setDesc("24-hour time, e.g. 08:00")
			.addText((text) =>
				text
					.setPlaceholder("08:00")
					.setValue(this.startTime)
					.onChange((val) => {
						this.startTime = val;
						updatePreview();
					}),
			);

		new Setting(contentEl)
			.setName("End time")
			.setDesc("If earlier than start, wraps past midnight")
			.addText((text) =>
				text
					.setPlaceholder("23:00")
					.setValue(this.endTime)
					.onChange((val) => {
						this.endTime = val;
						updatePreview();
					}),
			);

		new Setting(contentEl)
			.setName("Granularity")
			.setDesc("Duration of each time slot")
			.addDropdown((drop) => {
				GRANULARITY_OPTIONS.forEach((opt) => {
					drop.addOption(String(opt.value), opt.label);
				});
				drop.setValue(String(this.granularity));
				drop.onChange((val) => {
					this.granularity = parseInt(val);
					updatePreview();
				});
			});

		new Setting(contentEl)
			.setName("Right-to-left layout")
			.setDesc("Show time labels on the right side")
			.addToggle((toggle) =>
				toggle.setValue(this.rtl).onChange((val) => {
					this.rtl = val;
				}),
			);

		const previewRow = contentEl.createDiv({
			cls: "quicktimebox-modal-preview-row",
		});
		slotCountEl = previewRow.createSpan({
			cls: "quicktimebox-modal-preview",
		});
		updatePreview();

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Insert")
					.setCta()
					.onClick(() => this.insert()),
			)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close()),
			);
	}

	private insert() {
		const s = parseTimeToMinutes(this.startTime);
		const e = parseTimeToMinutes(this.endTime);

		if (s === null || e === null) {
			new Notice("Invalid time format. Use 24-hour time, e.g. 08:00");
			return;
		}
		if (s === e) {
			new Notice("Start and end time cannot be equal");
			return;
		}

		const data: TimePlanData = {
			startTime: this.startTime.trim(),
			endTime: this.endTime.trim(),
			granularity: this.granularity,
			entries: {},
			...(this.rtl ? { rtl: true } : {}),
		};

		const json = JSON.stringify(data, null, 2);
		this.editor.replaceSelection(`\`\`\`quicktimebox\n${json}\n\`\`\``);
		this.close();
	}

	onClose() {
		this.contentEl.empty();
	}
}
