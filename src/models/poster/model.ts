import { renderPosterPng } from '@/infra/poster-renderer'

// Only the template and layout reach the preview page, which needs nothing else
const renderPreview = (searchParams: URLSearchParams) => {
  const parameters = new URLSearchParams()
  for (const name of ['layout', 'template']) {
    const value = searchParams.get(name)
    if (value) parameters.set(name, value)
  }
  return renderPosterPng(`/preview/render?${parameters}`)
}

export const posterModel = {
  renderPreview
}
