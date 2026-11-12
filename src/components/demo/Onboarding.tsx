import { useId, useState } from "react";
import type { FormEvent } from "react";
import { CompanyAvatar } from "../marketing/primitives";
import type { DemoAction, DemoState } from "./demo-state";

const LIKE_CHOICES = [
  "Music",
  "Gardening",
  "Coffee with friends",
  "Walks",
  "Cards",
  "Films",
] as const;
const NAME_MAX = 40;
const LIKE_MAX = 30;
const LIKES_LIMIT = 6;

interface StepProps {
  state: DemoState;
  dispatch: (action: DemoAction) => void;
}

function SkipAsJoe({ dispatch }: Pick<StepProps, "dispatch">) {
  return (
    <button
      type="button"
      className="m-button m-button--ghost"
      onClick={() => dispatch({ type: "skip" })}
    >
      Skip, I’ll be Joe
    </button>
  );
}

function NameStep({ state, dispatch }: StepProps) {
  const id = useId();
  const [name, setName] = useState(state.profile.name);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) dispatch({ type: "name", name });
  };
  return (
    <form className="demo-form" onSubmit={submit}>
      <CompanyAvatar size="lg" mode="greet" />
      <label htmlFor={id}>Hello! What should I call you?</label>
      <input
        id={id}
        className="demo-input"
        value={name}
        maxLength={NAME_MAX}
        autoComplete="given-name"
        placeholder="Your first name"
        onChange={(event) => setName(event.target.value)}
      />
      <button type="submit" className="m-button m-button--amber" disabled={!name.trim()}>
        Next
      </button>
      <SkipAsJoe dispatch={dispatch} />
    </form>
  );
}

function HelperStep({ state, dispatch }: StepProps) {
  const nameId = useId();
  const relationId = useId();
  const [name, setName] = useState(state.profile.helper?.name ?? "");
  const [relation, setRelation] = useState(state.profile.helper?.relation ?? "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    dispatch({
      type: "helper",
      helper: name.trim() ? { name: name.trim(), relation: relation.trim() } : null,
    });
  };
  return (
    <form className="demo-form" onSubmit={submit}>
      <p>Who helps you out sometimes? Company only ever asks them one clear question.</p>
      <label htmlFor={nameId}>Their name</label>
      <input
        data-autofocus
        id={nameId}
        className="demo-input"
        value={name}
        maxLength={NAME_MAX}
        placeholder="For example, Maya"
        onChange={(event) => setName(event.target.value)}
      />
      <label htmlFor={relationId}>Who they are to you</label>
      <input
        id={relationId}
        className="demo-input"
        value={relation}
        maxLength={LIKE_MAX}
        placeholder="For example, daughter"
        onChange={(event) => setRelation(event.target.value)}
      />
      <button type="submit" className="m-button m-button--amber">
        {name.trim() ? "Next" : "No one for now"}
      </button>
    </form>
  );
}

function LikesStep({ state, dispatch }: StepProps) {
  const id = useId();
  const [likes, setLikes] = useState<readonly string[]>(state.profile.likes);
  const [other, setOther] = useState("");
  const toggle = (like: string) =>
    setLikes((current) =>
      current.includes(like)
        ? current.filter((item) => item !== like)
        : [...current, like].slice(0, LIKES_LIMIT),
    );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const extra = other.trim();
    const all = extra && !likes.includes(extra) ? [...likes, extra] : likes;
    dispatch({ type: "likes", likes: all.slice(0, LIKES_LIMIT) });
  };
  return (
    <form className="demo-form" onSubmit={submit}>
      <fieldset className="demo-likes">
        <legend>What do you enjoy? Pick any.</legend>
        {LIKE_CHOICES.map((like) => (
          <button
            key={like}
            type="button"
            className="demo-like"
            aria-pressed={likes.includes(like)}
            onClick={() => toggle(like)}
          >
            {like}
          </button>
        ))}
      </fieldset>
      <label htmlFor={id}>Anything else?</label>
      <input
        id={id}
        className="demo-input"
        value={other}
        maxLength={LIKE_MAX}
        placeholder="For example, birdwatching"
        onChange={(event) => setOther(event.target.value)}
      />
      <button type="submit" className="m-button m-button--amber">
        Done
      </button>
    </form>
  );
}

export function Onboarding({ state, dispatch }: StepProps) {
  if (state.screen === "name") return <NameStep state={state} dispatch={dispatch} />;
  if (state.screen === "helper") return <HelperStep state={state} dispatch={dispatch} />;
  return <LikesStep state={state} dispatch={dispatch} />;
}
