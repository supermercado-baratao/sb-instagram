import { catalogModel } from '@/models/catalog/model'

export const GET = async (
  _request: Request,
  { params }: RouteContext<'/catalogo/sem-ean/[name]'>
) => {
  const { name } = await params
  const image = await catalogModel.readNoEanImage(name)
  if (!image) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(image), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' }
  })
}
