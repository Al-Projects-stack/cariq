import logging
from fastapi import APIRouter, Form, Header, HTTPException, Request
from fastapi.responses import Response
from twilio.request_validator import RequestValidator
from twilio.twiml.messaging_response import MessagingResponse

from app.config import settings
from app.routers.query import rag_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["whatsapp"])


@router.post("/whatsapp")
async def whatsapp_webhook(
    request: Request,
    Body: str = Form(""),
    From: str = Form(""),
    ProfileName: str = Form(""),
    x_twilio_signature: str | None = Header(default=None, alias="X-Twilio-Signature"),
):
    """Incoming WhatsApp message webhook from Twilio.

    Validates the Twilio request signature, runs the question through the
    existing RAG pipeline, and replies with TwiML. Any RAG failure returns a
    friendly apology (HTTP 200) so Twilio does not retry / duplicate.
    """
    if not settings.twilio_auth_token:
        logger.error("TWILIO_AUTH_TOKEN is not configured")
        raise HTTPException(status_code=503, detail="WhatsApp webhook not configured")

    form = await request.form()
    form_dict = {k: v for k, v in form.items()}

    validator = RequestValidator(settings.twilio_auth_token)
    url = str(request.url)
    signature = x_twilio_signature or ""
    if not validator.validate(url, form_dict, signature):
        logger.warning(f"Invalid Twilio signature from {From}")
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")

    question = (Body or "").strip()
    session_id = (From or "").strip() or "unknown"
    name = (ProfileName or "").strip()

    resp = MessagingResponse()

    if not question:
        msg = resp.message(
            "Hi "
            + (name or "there")
            + "! I'm CarIQ's car-buying assistant. Send me a question about a "
              "car model (e.g. 'Tell me about the Toyota Corolla') and I'll look "
              "it up for you."
        )
        return Response(str(resp), media_type="application/xml")

    try:
        result = await rag_service.query(question=question, session_id=session_id)
    except ValueError as e:
        logger.warning(f"RAG validation error for {session_id}: {e}")
        msg = resp.message("Sorry, I couldn't understand that. Try rephrasing your question.")
        return Response(str(resp), media_type="application/xml")
    except Exception as e:
        logger.error(f"RAG query error for {session_id}: {e}", exc_info=True)
        msg = resp.message(
            "Sorry, something went wrong on our end. Please try again in a moment."
        )
        return Response(str(resp), media_type="application/xml")

    # rag_service.query returns a QueryResponse-like object; pull the answer text.
    text = getattr(result, "answer", None)
    if text is None:
        text = result if isinstance(result, str) else str(result)
    text = (text or "").strip()
    if not text:
        text = "I didn't find an answer for that. Try asking about a specific car model."

    # TwiML body limit is 1600 characters; keep a comfortable margin.
    if len(text) > 1500:
        text = text[:1500].rsplit(" ", 1)[0] + "…"

    resp.message(text)
    return Response(str(resp), media_type="application/xml")
