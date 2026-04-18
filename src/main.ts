import { Editor, Plugin } from "obsidian";
import { QuickTimeBoxModal } from "./ui/QuickTimeBoxModal";
import { QuickTimeBoxView } from "./ui/QuickTimeBoxRenderer";
import { TimePlanData } from "./types";

export default class QuickTimeBoxPlugin extends Plugin {
	onload() {
		this.addCommand({
			id: "insert",
			name: "Insert time planner",
			editorCallback: (editor: Editor) => {
				new QuickTimeBoxModal(this.app, editor).open();
			},
		});

		this.registerMarkdownCodeBlockProcessor(
			"quicktimebox",
			(source, el, ctx) => {
				let data: TimePlanData;
				try {
					data = JSON.parse(source) as TimePlanData;
					if (!data.entries) data.entries = {};
				} catch {
					el.createEl("p", {
						text: "Invalid time planner data.",
						cls: "quicktimebox-error",
					});
					return;
				}
				ctx.addChild(new QuickTimeBoxView(el, data, ctx, this.app));
			},
		);
	}

	onunload() {}
}
