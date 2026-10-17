import { templates } from '@/app/(pages)/preview/_components/fixtures'
import {
  DEFAULT_POSTER_LAYOUT,
  getPageTemplate,
  isPosterLayout
} from '@/domain/poster'

type SearchParameters = Record<string, string | string[] | undefined>

export const getPreviewOptions = (parameters: SearchParameters) => {
  const requestedLayout = Number(parameters.layout)
  return {
    layout: isPosterLayout(requestedLayout)
      ? requestedLayout
      : DEFAULT_POSTER_LAYOUT,
    template: getPageTemplate(templates, String(parameters.template))
  }
}
