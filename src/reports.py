"""Gerador de relatórios em PDF a partir de uma árvore GEDCOM carregada."""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gedcom_loader import GedcomTree, Person  # noqa: E402

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

_TABLE_STYLE = TableStyle(
    [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c3e50")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]
)


def _sorted_people(tree: GedcomTree) -> list[Person]:
    return sorted(tree.people.values(), key=lambda p: (p.surname.strip(), p.given_name.strip()))


def _people_table(tree: GedcomTree) -> Table:
    rows = [["Nome", "Sexo", "Nascimento", "Local Nasc.", "Falecimento", "Local Fal."]]
    for person in _sorted_people(tree):
        rows.append(
            [
                person.full_name or "(sem nome)",
                person.sex or "-",
                person.birth_date or "-",
                person.birth_place or "-",
                person.death_date or "-",
                person.death_place or "-",
            ]
        )
    table = Table(rows, repeatRows=1, colWidths=[5 * cm, 1.2 * cm, 2.3 * cm, 4 * cm, 2.3 * cm, 4 * cm])
    table.setStyle(_TABLE_STYLE)
    return table


def _families_table(tree: GedcomTree) -> Table:
    rows = [["Cônjuge 1", "Cônjuge 2", "Casamento", "Local", "Filhos"]]
    for family in tree.families.values():
        husband = tree.people.get(family.husband_id)
        wife = tree.people.get(family.wife_id)
        children = tree.children_of(family.id)
        rows.append(
            [
                husband.full_name if husband else "-",
                wife.full_name if wife else "-",
                family.marriage_date or "-",
                family.marriage_place or "-",
                ", ".join(c.full_name for c in children) or "-",
            ]
        )
    table = Table(rows, repeatRows=1, colWidths=[3.5 * cm, 3.5 * cm, 2.3 * cm, 3.5 * cm, 5.7 * cm])
    table.setStyle(_TABLE_STYLE)
    return table


def generate_pdf_report(tree: GedcomTree, output_path: str | Path, title: str = "Relatório Genealógico") -> Path:
    """Gera um relatório em PDF (paisagem A4) com a lista de pessoas e famílias da árvore."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=landscape(A4),
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title=title,
    )

    story = [
        Paragraph(title, styles["Title"]),
        Paragraph(f"Gerado em {date.today().strftime('%d/%m/%Y')}", styles["Normal"]),
        Spacer(1, 0.5 * cm),
        Paragraph(
            f"{len(tree.people)} pessoas &middot; {len(tree.families)} famílias &middot; {len(tree.sources)} fontes",
            styles["Normal"],
        ),
        Spacer(1, 1 * cm),
        Paragraph("Pessoas", styles["Heading2"]),
        Spacer(1, 0.3 * cm),
        _people_table(tree),
        PageBreak(),
        Paragraph("Famílias", styles["Heading2"]),
        Spacer(1, 0.3 * cm),
        _families_table(tree),
    ]

    doc.build(story)
    return output_path


if __name__ == "__main__":
    gedcom_path = sys.argv[1] if len(sys.argv) > 1 else "data/familia_miglioli.ged"
    output = sys.argv[2] if len(sys.argv) > 2 else "examples/relatorio_familia_miglioli.pdf"

    tree = GedcomTree(gedcom_path)
    path = generate_pdf_report(tree, output, title="Relatório Genealógico - Família Miglioli")
    print(f"Relatório gerado em {path}")
