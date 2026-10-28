/** Информация об одной функции. */
export interface FunctionInfo {
    name: string;
    startLine: number;
    endLine: number;
    length: number;
    maxDepth: number;
}

/** Пороговые значения для оценки функций. */
export interface Limits {
    maxLength: number;
    maxDepth: number;
}

/** Результат оценки одной функции. */
export interface AnalysisResult {
    info: FunctionInfo;
    tooLong: boolean;
    tooDeep: boolean;
}

/** Слова, после которых "(...) {" не является заголовком функции. */
const CONTROL = new Set(['if', 'for', 'while', 'switch', 'catch', 'else', 'return']);

/** Регулярное выражение заголовка функции: [тип...] имя(параметры) [const] [{]. */
const HEADER = /^\s*(?:[\w:<>,*&~]+\s+)+([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:const)?\s*(?:noexcept)?\s*\{?\s*$/;

/**
 * Убирает строковые литералы и комментарии "//", сохраняя позиции символов.
 * @param line исходная строка кода
 * @returns строка той же длины без строк и комментариев
 */
function clean(line: string): string {
    return line
        .replace(/"(?:[^"\\]|\\.)*"/g, m => ' '.repeat(m.length))
        .replace(/\/\/.*$/, m => ' '.repeat(m.length));
}

/**
 * Находит функции в списке строк и считает их длину и вложенность.
 * @param lines строки кода
 * @param firstLine номер первой строки в файле (для выделения)
 * @returns список найденных функций
 */
export function findFunctions(lines: string[], firstLine = 0): FunctionInfo[] {
    const result: FunctionInfo[] = [];
    const stack: number[] = [];
    let current: { name: string; start: number; maxDepth: number; depth: number } | null = null;
    let pendingName: string | null = null;
    let pendingStart = 0;

    lines.forEach((raw, i) => {
        const line = clean(raw);
        const lineNo = firstLine + i;

        if (!current) {
            const m = line.match(HEADER);
            if (m && !CONTROL.has(m[1])) {
                pendingName = m[1];
                pendingStart = lineNo;
            }
        }

        for (const ch of line) {
            if (ch === '{') {
                if (!current && pendingName) {
                    current = { name: pendingName, start: pendingStart, maxDepth: 0, depth: 0 };
                    pendingName = null;
                    stack.push(1);
                } else {
                    stack.push(0);
                    if (current) {
                        current.depth++;
                        current.maxDepth = Math.max(current.maxDepth, current.depth);
                    }
                }
            } else if (ch === '}') {
                const kind = stack.pop();
                if (kind === 1 && current) {
                    result.push({
                        name: current.name,
                        startLine: current.start,
                        endLine: lineNo,
                        length: lineNo - current.start + 1,
                        maxDepth: current.maxDepth,
                    });
                    current = null;
                } else if (current) {
                    current.depth--;
                }
            }
        }

        if (pendingName && !line.match(HEADER) && line.trim() !== '' && !line.includes('{')) {
            pendingName = null;
        }
    });

    return result;
}

/**
 * Сравнивает каждую функцию с пороговыми значениями.
 * @param functions найденные функции
 * @param limits допустимые длина и вложенность
 * @returns результаты оценки в том же порядке
 */
export function evaluate(functions: FunctionInfo[], limits: Limits): AnalysisResult[] {
    return functions.map(info => ({
        info,
        tooLong: info.length > limits.maxLength,
        tooDeep: info.maxDepth > limits.maxDepth,
    }));
}