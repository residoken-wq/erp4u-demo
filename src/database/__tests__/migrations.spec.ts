import * as fs from "fs";
import * as path from "path";

describe("Database Migrations", () => {
  const migrationsDir = path.resolve(__dirname, "../migrations");

  it("contains migration files", () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(0);
  });

  it('does not reference schema prefix "public". in any migration file', () => {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".ts"));

    const offendingOccurrences: { file: string; line: number; text: string }[] =
      [];

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((lineText, index) => {
        if (lineText.includes('"public".')) {
          offendingOccurrences.push({
            file,
            line: index + 1,
            text: lineText.trim(),
          });
        }
      });
    }

    expect(offendingOccurrences).toEqual([]);
  });
});
