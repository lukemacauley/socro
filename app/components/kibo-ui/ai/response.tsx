import {
  type BundledLanguage,
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockFiles,
  CodeBlockHeader,
  CodeBlockItem,
  type CodeBlockProps,
  CodeBlockSelect,
  CodeBlockSelectContent,
  CodeBlockSelectItem,
  CodeBlockSelectTrigger,
  CodeBlockSelectValue,
  CodeBlockContext,
} from "../code-block";
import type { HTMLAttributes } from "react";
import { memo } from "react";
import ReactMarkdown, { type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "~/lib/utils";
import { Badge } from "../../ui/badge";

export type AIResponseProps = HTMLAttributes<HTMLDivElement> & {
  options?: Options;
  children: Options["children"];
};

const components: Options["components"] = {
  ol: ({ node, children, className, ...props }) => (
    <ol className={cn("ml-4 list-outside list-decimal", className)} {...props}>
      {children}
    </ol>
  ),
  li: ({ node, children, className, ...props }) => (
    <li className={cn("py-1", className)} {...props}>
      {children}
    </li>
  ),
  ul: ({ node, children, className, ...props }) => (
    <ul className={cn("ml-4 list-outside list-decimal", className)} {...props}>
      {children}
    </ul>
  ),
  strong: ({ node, children, className, ...props }) => (
    <span className={cn("font-semibold", className)} {...props}>
      {children}
    </span>
  ),
  a: ({ node, children, className, ...props }) => (
    <a
      className={cn("font-medium text-primary underline", className)}
      rel="noreferrer"
      target="_blank"
      {...props}
    >
      {children}
    </a>
  ),
  h1: ({ node, children, className, ...props }) => (
    <h1
      className={cn("mt-6 mb-2 font-semibold text-3xl", className)}
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ node, children, className, ...props }) => (
    <h2
      className={cn("mt-6 mb-2 font-semibold text-2xl", className)}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ node, children, className, ...props }) => (
    <h3 className={cn("mt-6 mb-2 font-semibold text-xl", className)} {...props}>
      {children}
    </h3>
  ),
  h4: ({ node, children, className, ...props }) => (
    <h4 className={cn("mt-6 mb-2 font-semibold text-lg", className)} {...props}>
      {children}
    </h4>
  ),
  h5: ({ node, children, className, ...props }) => (
    <h5
      className={cn("mt-6 mb-2 font-semibold text-base", className)}
      {...props}
    >
      {children}
    </h5>
  ),
  h6: ({ node, children, className, ...props }) => (
    <h6 className={cn("mt-6 mb-2 font-semibold text-sm", className)} {...props}>
      {children}
    </h6>
  ),
  pre: ({ node, className, children }) => {
    let language = "email";

    if (typeof node?.properties?.className === "string") {
      language = node.properties.className.replace("language-", "");
    }

    const childrenIsCode =
      typeof children === "object" &&
      children !== null &&
      "type" in children &&
      children.type === "code";

    if (!childrenIsCode) {
      return <pre>{children}</pre>;
    }

    const data: CodeBlockProps["data"] = [
      {
        language,
        filename: "index.js",
        code: (children.props as { children: string }).children,
      },
    ];

    // Special styling for email code blocks
    if (language === "email") {
      return (
        <div
          className={cn(
            "relative group",
            // "mt-8 pt-8 border-t-4 border-double border-sidebar-border",
            className
          )}
        >
          {/* <div className="flex items-center gap-4">
            <div className="h-[1px] w-full flex-1 bg-muted" />
            <Badge variant="muted">Email response below</Badge>
          </div> */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-auto bg-sidebar-border" />
            <div className="text-xs font-normal text-muted-foreground">
              Email response below
            </div>
          </div>
          <div className="absolute right-0 top-8">
            <CodeBlockContext.Provider
              value={{ value: language, onValueChange: undefined, data }}
            >
              <CodeBlockCopyButton
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onCopy={console.log}
                onError={console.error}
              />
            </CodeBlockContext.Provider>
          </div>
          <div className="pr-12 mt-4 prose max-w-none">
            <ReactMarkdown>{data[0].code}</ReactMarkdown>
          </div>
        </div>
      );
    }

    return (
      <CodeBlock
        className={cn("my-4 h-auto", className)}
        data={data}
        defaultValue={data[0].language}
      >
        <CodeBlockHeader>
          <CodeBlockFiles>
            {(item) => (
              <CodeBlockFilename key={item.language} value={item.language}>
                {item.filename}
              </CodeBlockFilename>
            )}
          </CodeBlockFiles>
          <CodeBlockSelect>
            <CodeBlockSelectTrigger>
              <CodeBlockSelectValue />
            </CodeBlockSelectTrigger>
            <CodeBlockSelectContent>
              {(item) => (
                <CodeBlockSelectItem key={item.language} value={item.language}>
                  {item.language}
                </CodeBlockSelectItem>
              )}
            </CodeBlockSelectContent>
          </CodeBlockSelect>
          <CodeBlockCopyButton
            onCopy={() => console.log("Copied code to clipboard")}
            onError={(err) =>
              console.error(`Failed to copy code to clipboard: ${err}`)
            }
          />
        </CodeBlockHeader>
        <CodeBlockBody>
          {(item) => (
            <CodeBlockItem key={item.language} value={item.language}>
              <CodeBlockContent language={item.language as BundledLanguage}>
                {item.code}
              </CodeBlockContent>
            </CodeBlockItem>
          )}
        </CodeBlockBody>
      </CodeBlock>
    );
  },
};

export const AIResponse = memo(
  ({ className, options, children, ...props }: AIResponseProps) => {
    return (
      <div
        className={cn(
          "size-full prose prose-p:text-primary prose-li:text-primary prose-strong:text-primary prose-headings:text-primary max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className
        )}
        {...props}
      >
        <ReactMarkdown
          components={components}
          remarkPlugins={[remarkGfm]}
          {...options}
        >
          {children}
        </ReactMarkdown>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
