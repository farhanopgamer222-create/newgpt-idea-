"use client";
import { useRef, useState, type ComponentPropsWithoutRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  const code = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  return <div className="code-block"><div className="code-toolbar"><span>Code</span><button onClick={async () => { try { await navigator.clipboard.writeText(code.current?.textContent ?? ""); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } }}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy code"}</button></div><pre {...props} ref={code}>{children}</pre></div>;
}
export function ChatMarkdown({ content }: { content: string }) {
  return <div className="markdown"><Markdown remarkPlugins={[remarkGfm]} components={{ pre: CodeBlock, a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>, table: ({ children, ...props }) => <div className="table-scroll"><table {...props}>{children}</table></div> }}>{content}</Markdown></div>;
}
