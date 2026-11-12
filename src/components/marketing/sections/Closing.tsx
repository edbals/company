import { ArrowRight } from "lucide-react";
import { DEMO_PATH } from "../content";
import { Band, CompanyAvatar } from "../primitives";
import "./Closing.css";
import { Sun } from "./Decor";

export function Closing() {
  return (
    <Band id="closing" labelledBy="closing-title" stage className="closing-band">
      <div className="closing">
        <div className="closing-art">
          <Sun className="closing-sun" />
          <CompanyAvatar size="lg" className="closing-avatar" />
        </div>
        <h2 id="closing-title" className="m-h2 closing-title">
          See it for yourself.
        </h2>
        <a href={DEMO_PATH} className="m-button m-button--amber">
          Try demo <ArrowRight size={20} aria-hidden />
        </a>
      </div>
    </Band>
  );
}
