import { createFileRoute } from '@tanstack/react-router'
import { WebsiteBuilderPage } from '../website_3'

export const Route = createFileRoute('/website')({
  component: WebsiteBuilderPage,
})
