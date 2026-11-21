# Builds the free "teacher pay by percentage" spreadsheet offered by the blog article,
# in French and in Arabic. Usage: python make_template.py <output folder>
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

ROWS = 15  # groups the sheet has room for

TEXTS = {
    "fr": {
        "file": "modele-paie-professeurs-pourcentage.xlsx",
        "rtl": False,
        "font": "Calibri",
        "sheet": "Paie au pourcentage",
        "help_sheet": "Mode d'emploi",
        "title": "Paie des professeurs au pourcentage",
        "month": "Mois :",
        "headers": ["Groupe", "Professeur", "Élèves", "Tarif mensuel", "Facturé", "Encaissé", "Pourcentage", "Part du professeur", "Part du centre"],
        "total": "Total",
        "sample": ["Exemple : 3e Maths A", "Nom du professeur"],
        "note": "Cellules jaunes : à saisir. Cellules grises : calculées. La première ligne est un exemple à remplacer.",
        "help": [
            "Comment utiliser ce modèle",
            "1. Une ligne par groupe : son nom, son professeur, le nombre d'élèves et le tarif mensuel.",
            "2. « Encaissé » : ce que les élèves du groupe ont réellement payé pendant le mois (pas ce qui est facturé).",
            "3. « Pourcentage » : la part convenue avec le professeur, par exemple 60 %.",
            "4. La part du professeur (Encaissé × Pourcentage) et la part du centre se calculent.",
            "5. Un paiement en retard compte dans le mois où il est encaissé.",
            "",
            "Ce modèle est un outil de calcul. Il ne traite pas des obligations fiscales et sociales.",
            "Modèle gratuit proposé par Acadex.",
        ],
    },
    "ar": {
        "file": "teacher-pay-percentage-ar.xlsx",
        "rtl": True,
        "font": "Arial",
        "sheet": "الأجور بالنسبة المئوية",
        "help_sheet": "طريقة الاستعمال",
        "title": "أجور الأساتذة بالنسبة المئوية",
        "month": "الشهر:",
        "headers": ["المجموعة", "الأستاذ", "عدد التلاميذ", "المعلوم الشهري", "المفوتر", "المقبوض", "النسبة", "نصيب الأستاذ", "نصيب المركز"],
        "total": "المجموع",
        "sample": ["مثال: الثالثة رياضيات أ", "اسم الأستاذ"],
        "note": "الخانات الصفراء: تُدخلها أنت. الخانات الرمادية: تُحتسب. السطر الأول مثال يُعوَّض.",
        "help": [
            "طريقة استعمال هذا النموذج",
            "1. سطر لكل مجموعة: اسمها، أستاذها، عدد التلاميذ والمعلوم الشهري.",
            "2. «المقبوض»: ما دفعه تلاميذ المجموعة فعلاً خلال الشهر (لا المبلغ المفوتر).",
            "3. «النسبة»: النصيب المتفق عليه مع الأستاذ، مثلاً 60 %.",
            "4. نصيب الأستاذ (المقبوض × النسبة) ونصيب المركز يُحتسبان.",
            "5. الدفعة المتأخرة تُحتسب في الشهر الذي تُقبض فيه.",
            "",
            "هذا النموذج أداة حساب. لا يخص الواجبات الجبائية والاجتماعية.",
            "نموذج مجاني من Acadex.",
        ],
    },
}

INPUT = PatternFill("solid", start_color="FFF8DC")
CALC = PatternFill("solid", start_color="EEF1F5")
HEAD = PatternFill("solid", start_color="1D4ED8")
THIN = Side(style="thin", color="B8C0CC")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
MONEY = '#,##0.000'


def build(lang, folder):
    t = TEXTS[lang]
    font = t["font"]
    wb = Workbook()
    ws = wb.active
    ws.title = t["sheet"]
    ws.sheet_view.rightToLeft = t["rtl"]
    side = "right" if t["rtl"] else "left"

    ws["A1"] = t["title"]
    ws["A1"].font = Font(name=font, size=15, bold=True)
    ws["A1"].alignment = Alignment(horizontal=side)
    ws.merge_cells("A1:I1")
    ws["A2"] = t["month"]
    ws["A2"].font = Font(name=font, bold=True)
    ws["B2"].fill = INPUT
    ws["B2"].border = BOX
    ws["A3"] = t["note"]
    ws["A3"].font = Font(name=font, size=9, italic=True, color="555555")
    ws.merge_cells("A3:I3")

    head_row = 5
    for col, label in enumerate(t["headers"], start=1):
        cell = ws.cell(row=head_row, column=col, value=label)
        cell.font = Font(name=font, bold=True, color="FFFFFF")
        cell.fill = HEAD
        cell.border = BOX
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[head_row].height = 32

    first = head_row + 1
    last = first + ROWS - 1
    for row in range(first, last + 1):
        for col in range(1, 10):
            cell = ws.cell(row=row, column=col)
            cell.border = BOX
            cell.font = Font(name=font)
            cell.fill = CALC if col in (5, 8, 9) else INPUT
        # Formulas stay empty until the row is filled in.
        ws.cell(row=row, column=5, value=f'=IF(AND(C{row}<>"",D{row}<>""),C{row}*D{row},"")')
        ws.cell(row=row, column=8, value=f'=IF(AND(F{row}<>"",G{row}<>""),F{row}*G{row},"")')
        ws.cell(row=row, column=9, value=f'=IF(AND(F{row}<>"",G{row}<>""),F{row}-H{row},"")')
        for col in (4, 5, 6, 8, 9):
            ws.cell(row=row, column=col).number_format = MONEY
        ws.cell(row=row, column=7).number_format = "0%"
        ws.cell(row=row, column=3).number_format = "0"

    # The example of the article: 12 students at 80, 800 collected, 60 %.
    ws.cell(row=first, column=1, value=t["sample"][0])
    ws.cell(row=first, column=2, value=t["sample"][1])
    ws.cell(row=first, column=3, value=12)
    ws.cell(row=first, column=4, value=80)
    ws.cell(row=first, column=6, value=800)
    ws.cell(row=first, column=7, value=0.6)

    total = last + 1
    ws.cell(row=total, column=1, value=t["total"])
    for col in range(1, 10):
        cell = ws.cell(row=total, column=col)
        cell.font = Font(name=font, bold=True)
        cell.border = BOX
        cell.fill = CALC
    for col, letter in ((3, "C"), (5, "E"), (6, "F"), (8, "H"), (9, "I")):
        cell = ws.cell(row=total, column=col, value=f"=SUM({letter}{first}:{letter}{last})")
        cell.number_format = "0" if col == 3 else MONEY

    percent = DataValidation(type="decimal", operator="between", formula1="0", formula2="1", allow_blank=True)
    ws.add_data_validation(percent)
    percent.add(f"G{first}:G{last}")

    for letter, width in zip("ABCDEFGHI", (26, 22, 11, 15, 15, 15, 13, 18, 16)):
        ws.column_dimensions[letter].width = width
    ws.freeze_panes = ws.cell(row=first, column=1)
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True

    info = wb.create_sheet(t["help_sheet"])
    info.sheet_view.rightToLeft = t["rtl"]
    info.column_dimensions["A"].width = 110
    for index, line in enumerate(t["help"], start=1):
        cell = info.cell(row=index, column=1, value=line)
        cell.font = Font(name=font, size=14 if index == 1 else 11, bold=index == 1)
        cell.alignment = Alignment(horizontal=side, wrap_text=True)

    wb.properties.title = t["title"]
    wb.properties.creator = "Acadex"
    out = Path(folder) / t["file"]
    wb.save(out)
    return out


if __name__ == "__main__":
    folder = Path(sys.argv[1])
    folder.mkdir(parents=True, exist_ok=True)
    for lang in TEXTS:
        print("wrote", build(lang, folder))
