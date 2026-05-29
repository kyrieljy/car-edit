import { NextResponse } from "next/server"
import { deleteChatSession, getChatMessages, updateChatAttachmentImageUrl, updateChatMessageResultImageUrl, updateChatSession } from "@/lib/server/db"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { materializeImageUrl } from "@/lib/server/image-materializer"
import type { ChatAttachment, ChatMessage } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const user = requireUser()
    const messages = await materializeChatHistoryImages(getChatMessages(context.params.id, user.id), user.id)
    return NextResponse.json({ messages })
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Chat session failed" }, { status: 404 })
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const user = requireUser()
    const body = await request.json()
    const session = updateChatSession({
      id: context.params.id,
      userId: user.id,
      pinned: typeof body.pinned === "boolean" ? body.pinned : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
    })
    return NextResponse.json(session)
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Chat session update failed" }, { status: 404 })
  }
}

async function materializeChatHistoryImages(messages: ChatMessage[], userId: string) {
  const nextMessages: ChatMessage[] = []
  for (const message of messages) {
    let nextMessage = message
    if (message.resultImageUrl) {
      const result = await materializeImageUrl(message.resultImageUrl, "result", `chat-result-${message.id}`)
      if (result?.url && result.url !== message.resultImageUrl) {
        updateChatMessageResultImageUrl(message.id, userId, result.url)
        nextMessage = { ...nextMessage, resultImageUrl: result.url }
      }
    }
    const attachments: ChatAttachment[] = []
    for (const attachment of nextMessage.attachments) {
      const kind = attachment.type === "result" ? "result" : "chat_upload"
      const image = await materializeImageUrl(attachment.url, kind, `chat-${attachment.type}-${attachment.id}`)
      if (image?.url && image.url !== attachment.url) {
        updateChatAttachmentImageUrl({
          attachmentId: attachment.id,
          userId,
          url: image.url,
          fileName: image.fileName,
          mime: image.mime,
          size: image.size,
        })
        attachments.push({ ...attachment, url: image.url, fileName: image.fileName, mime: image.mime, size: image.size })
      } else {
        attachments.push(attachment)
      }
    }
    nextMessages.push({ ...nextMessage, attachments })
  }
  return nextMessages
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    const user = requireUser()
    return NextResponse.json(deleteChatSession(context.params.id, user.id))
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Chat session delete failed" }, { status: 404 })
  }
}
