"""Reading and validating uploaded PDF / CSV / Excel files."""
import csv
import io
from pathlib import Path

import pandas as pd
from fastapi import HTTPException, UploadFile

from config import (
    ALLOWED_EXTENSIONS,
    MAX_CSV_CHARACTERS,
    MAX_CSV_ROWS,
    MAX_UPLOAD_SIZE,
)


def get_extension(file: UploadFile) -> str:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Please select a file.")

    extension = Path(file.filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF, CSV, or Excel (.xlsx) file.",
        )

    return extension


async def read_upload(file: UploadFile) -> bytes:
    file_bytes = await file.read(MAX_UPLOAD_SIZE + 1)

    if not file_bytes:
        raise HTTPException(
            status_code=400, detail="The uploaded file is empty."
        )

    if len(file_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413, detail="The file must be 10 MB or smaller."
        )

    return file_bytes


def validate_pdf(file_bytes: bytes, content_type: str | None) -> None:
    if content_type and content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="The uploaded PDF has an invalid content type.",
        )

    if not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400, detail="The uploaded file is not a valid PDF."
        )


def spreadsheet_to_csv_text(extension: str, file_bytes: bytes) -> str:
    """Turn a .csv or .xlsx upload into CSV text and validate it."""
    if extension == ".csv":
        csv_text = _decode_csv(file_bytes)
    else:
        csv_text = _excel_to_csv(file_bytes)

    _validate_csv_text(csv_text)
    return csv_text


def _decode_csv(file_bytes: bytes) -> str:
    try:
        return file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        pass

    try:
        return file_bytes.decode("cp1252")
    except UnicodeDecodeError as error:
        raise HTTPException(
            status_code=400,
            detail="Unable to read this CSV. Please save it as UTF-8.",
        ) from error


def _excel_to_csv(file_bytes: bytes) -> str:
    try:
        dataframe = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
        dataframe = dataframe.astype(object).where(pd.notna(dataframe), "")
        return dataframe.to_csv(index=False)
    except Exception as error:
        print("EXCEL READ ERROR:", repr(error))
        raise HTTPException(
            status_code=400,
            detail=(
                "Unable to read this Excel file. "
                "Please check that it is a valid .xlsx workbook."
            ),
        ) from error


def _validate_csv_text(csv_text: str) -> None:
    if len(csv_text) > MAX_CSV_CHARACTERS:
        raise HTTPException(
            status_code=413,
            detail="The spreadsheet is too large for the current assistant limit.",
        )

    try:
        rows = [
            row
            for row in csv.reader(io.StringIO(csv_text))
            if any(cell.strip() for cell in row)
        ]
    except csv.Error as error:
        raise HTTPException(
            status_code=400,
            detail="Unable to parse the spreadsheet data.",
        ) from error

    if len(rows) < 2:
        raise HTTPException(
            status_code=400,
            detail="The file needs a header row and at least one data row.",
        )

    if len(rows) - 1 > MAX_CSV_ROWS:
        raise HTTPException(
            status_code=413,
            detail=f"The current limit is {MAX_CSV_ROWS} data rows.",
        )

    headers = rows[0]

    if not any(header.strip() for header in headers):
        raise HTTPException(
            status_code=400, detail="The file must contain column names."
        )

    if any(len(row) != len(headers) for row in rows[1:]):
        raise HTTPException(
            status_code=400,
            detail="Some rows contain a different number of columns than the header.",
        )
