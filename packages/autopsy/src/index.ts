export type {
  Corpse,
  CorpseFacts,
  CorpsePage,
  CorpseSection,
  ExhumedPageInput,
  ShapeCluster,
  SiteFact,
} from './corpse'
export {condense, pathPrefixOf, signatureDistance} from './condense'
export {compileToSchemaJson, compileToTypeScript, type ManifestSchemaType} from './compile'
export {
  propose,
  repairPropose,
  humanDecisionsFromProposal,
  PROPOSE_ANATOMY_TOOL_NAME,
} from './propose'
export {AUTOPSY_SYSTEM_PROMPT, AUTOPSY_RERUN_RULE} from './prompt'
export type {
  AutopsyResult,
  AutopsyUsage,
  Evidence,
  FieldType,
  HumanDecision,
  ProposedField,
  ProposedType,
  SchemaProposal,
} from './proposal'
export {runAutopsy, type RunAutopsyArgs} from './run'
export {
  proposeAnatomyInputSchema,
  proposedTypeSchema,
  PROPOSE_ANATOMY_INPUT_JSON_SCHEMA,
} from './schema'
export {validateProposal, RESERVED_TYPE_NAMES, type ValidateResult} from './validate'
