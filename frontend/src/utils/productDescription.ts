/**
 * Utility to clean and format product descriptions.
 * For Combo products, removes technical child SKU lines such as:
 * "• NMN CARA DÙ CT_120x63 Xanh lá (x1.00)"
 * while preserving customer-friendly product descriptions and specifications.
 */
export const cleanComboDescription = (desc?: string): string => {
    if (!desc) return '';

    const isHtml = /<\/?[a-z][\s\S]*>/i.test(desc);

    if (isHtml) {
        return desc
            .replace(/<([a-z0-9]+)[^>]*>\s*(?:[•\-\*\u2022]\s*)?[^<]*?\([xX]\s*\d+(?:[\.,]\d+)?\)\s*[-:–—]?\s*([^<]*?)\s*<\/\1>/gi, (_match, tag, trailing) => {
                return trailing.trim() ? `<${tag}>${trailing.trim()}</${tag}>` : '';
            })
            .replace(/(?:^|<br\s*\/?>)\s*(?:[•\-\*\u2022]\s*)?[^<]*?\([xX]\s*\d+(?:[\.,]\d+)?\)\s*[-:–—]?\s*([^<]*?)(?=<br\s*\/?>|$)/gi, (_match, trailing) => {
                return trailing.trim() ? `<br/>${trailing.trim()}` : '';
            });
    }

    const lines = desc.split(/\r?\n/);
    const result: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            if (result.length > 0 && result[result.length - 1] !== '') {
                result.push('');
            }
            continue;
        }

        // Match combo SKU line: e.g. '• NMN CARA DÙ CT_120x63 Xanh lá (x1.00)' or '- SKU (x1.00) - Desc'
        const comboMatch = trimmed.match(/^(?:[•\-\*\u2022]\s*)?.*?\([xX]\s*\d+(?:[\.,]\d+)?\)\s*[-:–—]?\s*(.*)$/);
        if (comboMatch) {
            const trailing = comboMatch[1]?.trim();
            if (result.length > 0 && result[result.length - 1] !== '') {
                result.push(''); // Add blank line separator between components
            }
            if (trailing) {
                result.push(trailing);
            }
        } else {
            result.push(trimmed);
        }
    }

    return result.join('\n').trim();
};
