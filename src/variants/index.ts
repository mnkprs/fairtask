import type { Variant } from "../lib/variant.ts";
import { baseline } from "./baseline.ts";
import { v1Context } from "./v1-context.ts";
import { v2Specialists } from "./v2-specialists.ts";
import { v3Verify } from "./v3-verify.ts";
import { v4Calibrated } from "./v4-calibrated.ts";
import { v5CheapProbes } from "./v5-cheap-probes.ts";
import { v6TargetAware } from "./v6-target-aware.ts";
import { v7SonnetNocal } from "./v7-sonnet-nocal.ts";

export const VARIANTS: Record<string, Variant> = Object.fromEntries([baseline, v1Context, v2Specialists, v3Verify, v4Calibrated, v5CheapProbes, v6TargetAware, v7SonnetNocal].map((v) => [v.name, v]));
