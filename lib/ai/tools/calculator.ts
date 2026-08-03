/**
 * Safe arithmetic evaluation for model-supplied expressions. Deliberately
 * not `eval()`/`new Function()` — either would let a model-controlled
 * string execute arbitrary JavaScript, a real code-injection vector, not
 * a shortcut worth taking for a calculator. This is a small hand-written
 * recursive-descent parser: numbers, `+ - * / %`, parentheses, and unary
 * sign. Nothing else is legal input.
 */

type TokenType = "number" | "+" | "-" | "*" | "/" | "%" | "(" | ")";

interface Token {
  type: TokenType;
  value?: number;
}

const OPERATOR_CHARS = new Set(["+", "-", "*", "/", "%", "(", ")"]);

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression[i];
    if (ch === " " || ch === "\t" || ch === "\n") {
      i++;
      continue;
    }
    if (OPERATOR_CHARS.has(ch)) {
      tokens.push({ type: ch as TokenType });
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      let seenDot = false;
      while (j < expression.length && /[0-9.]/.test(expression[j])) {
        if (expression[j] === ".") {
          if (seenDot) {
            throw new Error(`Invalid number near "${expression.slice(i, j + 1)}".`);
          }
          seenDot = true;
        }
        j++;
      }
      const raw = expression.slice(i, j);
      const value = Number(raw);
      if (raw === "." || Number.isNaN(value)) {
        throw new Error(`Invalid number "${raw}".`);
      }
      tokens.push({ type: "number", value });
      i = j;
      continue;
    }
    throw new Error(`Unexpected character "${ch}" in expression.`);
  }
  return tokens;
}

/** expression := term (('+'|'-') term)* ; term := factor (('*'|'/'|'%') factor)* ; factor := ('+'|'-')? atom ; atom := number | '(' expression ')' */
class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  atEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const token = this.tokens[this.pos];
    if (!token) throw new Error("Unexpected end of expression.");
    this.pos++;
    return token;
  }

  parseExpression(): number {
    let value = this.parseTerm();
    while (this.peek()?.type === "+" || this.peek()?.type === "-") {
      const op = this.next().type;
      const rhs = this.parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    while (
      this.peek()?.type === "*" ||
      this.peek()?.type === "/" ||
      this.peek()?.type === "%"
    ) {
      const op = this.next().type;
      const rhs = this.parseFactor();
      if (op === "*") {
        value *= rhs;
      } else {
        if (rhs === 0) throw new Error("Division by zero.");
        value = op === "/" ? value / rhs : value % rhs;
      }
    }
    return value;
  }

  private parseFactor(): number {
    const token = this.peek();
    if (token?.type === "+" || token?.type === "-") {
      this.next();
      const value = this.parseFactor();
      return token.type === "-" ? -value : value;
    }
    return this.parseAtom();
  }

  private parseAtom(): number {
    const token = this.next();
    if (token.type === "number") return token.value as number;
    if (token.type === "(") {
      const value = this.parseExpression();
      const closing = this.next();
      if (closing.type !== ")") {
        throw new Error("Expected a closing parenthesis.");
      }
      return value;
    }
    throw new Error(`Unexpected token "${token.type}".`);
  }
}

/** Removes float noise (e.g. 0.1 + 0.2) without truncating real precision. */
function roundResult(value: number): number {
  return Math.round(value * 1e10) / 1e10;
}

export function calculate(expression: string): number {
  const trimmed = expression.trim();
  if (!trimmed) {
    throw new Error("Expression is empty.");
  }
  const parser = new Parser(tokenize(trimmed));
  const value = parser.parseExpression();
  if (!parser.atEnd()) {
    throw new Error("Unexpected trailing input in expression.");
  }
  return roundResult(value);
}
