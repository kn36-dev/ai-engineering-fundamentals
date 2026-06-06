export const clean = (str: string) =>
    str
        .replace(/^[ \t\u00a0]+/gm, "") // Catch regular, tab, and non-breaking spaces
        .replace(/[ \t\u00a0]+/g, " ") // Collapse them uniformly
        .replace(/\n+/g, " ")
        .trim();
