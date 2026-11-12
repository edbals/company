import { useId, useState } from "react";
import type { FormEvent } from "react";
import { DEMO_WORDS_MAX } from "@/lib/demo-contract";
import { firstName } from "./demo-state";
import type { DemoAction, DemoState } from "./demo-state";

const EXAMPLES = [
  "Live jazz with Walt on Thursday",
  "Something fun outside this weekend",
  "I'm out of milk",
  "Order my blood pressure pills",
] as const;

interface AskStepProps {
  state: DemoState;
  dispatch: (action: DemoAction) => void;
}

/** The free-text box. After a "chat" result it shows Company's question above it. */
export function AskStep({ state, dispatch }: AskStepProps) {
  const id = useId();
  const hintId = useId();
  const [words, setWords] = useState("");
  const isChat = state.result?.outcome.kind === "chat";
  const chat = isChat ? state.history.slice(-2) : [];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (words.trim()) dispatch({ type: "submit", words: words.trim() });
  };
  return (
    <form className="demo-form" onSubmit={submit}>
      {chat.map((turn, index) => (
        <p
          key={index}
          className={turn.who === "person" ? "demo-bubble demo-bubble--you" : "demo-bubble"}
        >
          {turn.text}
        </p>
      ))}
      <label htmlFor={id}>
        {isChat
          ? "Your answer"
          : `${firstName(state.profile)}, what would you like to do this week?`}
      </label>
      <textarea
        data-autofocus
        id={id}
        className="demo-input demo-textarea"
        value={words}
        rows={3}
        maxLength={DEMO_WORDS_MAX}
        aria-describedby={hintId}
        placeholder="Type anything, in your own words"
        onChange={(event) => setWords(event.target.value)}
      />
      <p id={hintId} className="demo-hint">
        {words.length}/{DEMO_WORDS_MAX}
      </p>
      {!isChat && (
        <div className="demo-examples" role="group" aria-label="Examples to try">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="demo-like"
              onClick={() => setWords(example)}
            >
              {example}
            </button>
          ))}
        </div>
      )}
      <button type="submit" className="m-button m-button--amber" disabled={!words.trim()}>
        Plan it
      </button>
      <button type="button" className="demo-link" onClick={() => dispatch({ type: "reset" })}>
        Not {firstName(state.profile)}? Change your details
      </button>
    </form>
  );
}
