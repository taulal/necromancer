import {refDataset, type GdrUri} from '@sanity/workflow-engine'
import {HQ_DATASET, PROJECT_ID} from './config'

/** GDR subject for a séance in HQ — `dataset:v9dl2xdi:hq:<id>`. */
export function seanceSubjectRef(documentId: string) {
  return refDataset({
    projectId: PROJECT_ID,
    dataset: HQ_DATASET,
    documentId: documentId.replace(/^drafts\./, ''),
    type: 'seance',
  })
}

export function seanceGdrUri(documentId: string): GdrUri {
  return seanceSubjectRef(documentId).id
}
