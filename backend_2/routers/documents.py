"""POST /ask-pdf : ask questions about an uploaded PDF, CSV or Excel file."""
import traceback

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from ai.document_qa import answer_csv_question, answer_pdf_question
from services.uploads import (
    get_extension,
    read_upload,
    spreadsheet_to_csv_text,
    validate_pdf,
)

router = APIRouter(tags=["documents"])


@router.post("/ask-pdf")
async def ask_pdf_question(
    file: UploadFile = File(...),
    question: str = Form(...),
):
    if not question or not question.strip():
        raise HTTPException(
            status_code=400,
            detail="Please enter a question about your file.",
        )

    extension = get_extension(file)

    try:
        file_bytes = await read_upload(file)

        # Gemini calls are blocking, so run them off the event loop.
        if extension == ".pdf":
            validate_pdf(file_bytes, file.content_type)
            result = await run_in_threadpool(
                answer_pdf_question,
                pdf_bytes=file_bytes,
                question=question,
            )
        else:
            csv_text = spreadsheet_to_csv_text(extension, file_bytes)
            result = await run_in_threadpool(
                answer_csv_question,
                csv_text=csv_text,
                question=question,
            )

        return {
            "answer": result.get("answer", "No answer returned."),
            "filename": file.filename,
            "chart_data": result.get("chart_data"),
            "chart_title": result.get("chart_title"),
            "chart_type": result.get("chart_type"),
        }

    except HTTPException:
        raise

    except Exception as error:
        print("\n========== DOCUMENT QUESTION ERROR ==========")
        print("Error:", repr(error))
        traceback.print_exc()
        print("=============================================\n")
        raise HTTPException(
            status_code=500,
            detail="Unable to answer the question from this file. Please try again.",
        )

    finally:
        await file.close()
