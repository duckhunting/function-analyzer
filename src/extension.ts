import * as vscode from 'vscode';
import { findFunctions, evaluate } from './analyzer';

/**
 * Точка входа расширения: регистрирует команду "Analyze C++ Functions".
 * @param context контекст расширения VS Code
 */
export function activate(context: vscode.ExtensionContext) {
	const output = vscode.window.createOutputChannel('Function Analyzer');
	const diagnostics = vscode.languages.createDiagnosticCollection('function-analyzer');

	const command = vscode.commands.registerCommand('functionAnalyzer.run', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) { return; }

		const doc = editor.document;
		const sel = editor.selection;
		const first = sel.isEmpty ? 0 : sel.start.line;
		const last = sel.isEmpty ? doc.lineCount - 1 : sel.end.line;

		const lines: string[] = [];
		for (let i = first; i <= last; i++) { lines.push(doc.lineAt(i).text); }

		const config = vscode.workspace.getConfiguration('functionAnalyzer');
		const limits = {
			maxLength: config.get<number>('maxLength', 30),
			maxDepth: config.get<number>('maxDepth', 3),
		};

		const results = evaluate(findFunctions(lines, first), limits);

		output.clear();
		output.appendLine(`Функций найдено: ${results.length} (пороги: ${limits.maxLength} строк, глубина ${limits.maxDepth})`);
		for (const r of results) {
			const flag = r.tooLong || r.tooDeep ? '⚠' : '✓';
			output.appendLine(`${flag} ${r.info.name}: ${r.info.length} строк, вложенность ${r.info.maxDepth}`);
		}
		output.show(true);

		const items: vscode.Diagnostic[] = [];
		for (const r of results) {
			if (!r.tooLong && !r.tooDeep) { continue; }
			const reasons: string[] = [];
			if (r.tooLong) { reasons.push(`длина ${r.info.length} > ${limits.maxLength}`); }
			if (r.tooDeep) { reasons.push(`вложенность ${r.info.maxDepth} > ${limits.maxDepth}`); }
			const range = doc.lineAt(r.info.startLine).range;
			items.push(new vscode.Diagnostic(range, `${r.info.name}: ${reasons.join(', ')}`, vscode.DiagnosticSeverity.Warning));
		}
		diagnostics.set(doc.uri, items);

		vscode.window.showInformationMessage(
			items.length === 0 ? 'Все функции в норме' : `Проблемных функций: ${items.length}`);
	});

	context.subscriptions.push(command, output, diagnostics);
}

/** Вызывается при отключении расширения. */
export function deactivate() { }