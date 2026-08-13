"""Parser base para arquivos GEDCOM, expondo pessoas, famílias e fontes
como estruturas Python simples para uso em relatórios e análises."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from gedcom.element.family import FamilyElement
from gedcom.element.individual import IndividualElement
from gedcom.parser import Parser


@dataclass
class Person:
    id: str
    given_name: str
    surname: str
    sex: str
    birth_date: str
    birth_place: str
    death_date: str
    death_place: str
    family_as_child: list = field(default_factory=list)
    family_as_spouse: list = field(default_factory=list)

    @property
    def full_name(self) -> str:
        return f"{self.given_name} {self.surname}".strip()


@dataclass
class Family:
    id: str
    husband_id: Optional[str]
    wife_id: Optional[str]
    children_ids: list
    marriage_date: str
    marriage_place: str


@dataclass
class Source:
    id: str
    title: str
    author: str


def _pointer_values(element, tag: str) -> list:
    return [child.get_value() for child in element.get_child_elements() if child.get_tag() == tag]


def _marriage_data(family_element) -> tuple[str, str]:
    for child in family_element.get_child_elements():
        if child.get_tag() != "MARR":
            continue
        date, place = "", ""
        for grandchild in child.get_child_elements():
            if grandchild.get_tag() == "DATE":
                date = grandchild.get_value()
            elif grandchild.get_tag() == "PLAC":
                place = grandchild.get_value()
        return date, place
    return "", ""


class GedcomTree:
    """Coleção indexada de pessoas, famílias e fontes de um arquivo GEDCOM."""

    def __init__(self, path: "str | Path"):
        self.path = Path(path)
        self._parser = Parser()
        self._parser.parse_file(str(self.path))

        self.people: dict[str, Person] = {}
        self.families: dict[str, Family] = {}
        self.sources: dict[str, Source] = {}

        self._load()

    def _load(self) -> None:
        for element in self._parser.get_root_child_elements():
            if isinstance(element, IndividualElement):
                self._load_person(element)
            elif isinstance(element, FamilyElement):
                self._load_family(element)
            elif element.get_tag() == "SOUR":
                self._load_source(element)

    def _load_person(self, element: IndividualElement) -> None:
        given, surname = element.get_name()
        birth_date, birth_place, _ = element.get_birth_data()
        death_date, death_place, _ = element.get_death_data()

        self.people[element.get_pointer()] = Person(
            id=element.get_pointer(),
            given_name=given,
            surname=surname,
            sex=element.get_gender(),
            birth_date=birth_date,
            birth_place=birth_place,
            death_date=death_date,
            death_place=death_place,
            family_as_child=_pointer_values(element, "FAMC"),
            family_as_spouse=_pointer_values(element, "FAMS"),
        )

    def _load_family(self, element: FamilyElement) -> None:
        marriage_date, marriage_place = _marriage_data(element)
        husbands = _pointer_values(element, "HUSB")
        wives = _pointer_values(element, "WIFE")

        self.families[element.get_pointer()] = Family(
            id=element.get_pointer(),
            husband_id=husbands[0] if husbands else None,
            wife_id=wives[0] if wives else None,
            children_ids=_pointer_values(element, "CHIL"),
            marriage_date=marriage_date,
            marriage_place=marriage_place,
        )

    def _load_source(self, element) -> None:
        title = ""
        author = ""
        for child in element.get_child_elements():
            if child.get_tag() == "TITL":
                title = child.get_value()
            elif child.get_tag() == "AUTH":
                author = child.get_value()
        self.sources[element.get_pointer()] = Source(id=element.get_pointer(), title=title, author=author)

    # ---- Consultas úteis ----

    def children_of(self, family_id: str) -> list[Person]:
        family = self.families.get(family_id)
        if not family:
            return []
        return [self.people[cid] for cid in family.children_ids if cid in self.people]

    def parents_of(self, person_id: str) -> list[Person]:
        person = self.people.get(person_id)
        if not person or not person.family_as_child:
            return []
        parents = []
        for family_id in person.family_as_child:
            family = self.families.get(family_id)
            if not family:
                continue
            for parent_id in (family.husband_id, family.wife_id):
                if parent_id and parent_id in self.people:
                    parents.append(self.people[parent_id])
        return parents

    def spouses_of(self, person_id: str) -> list[Person]:
        person = self.people.get(person_id)
        if not person or not person.family_as_spouse:
            return []
        spouses = []
        for family_id in person.family_as_spouse:
            family = self.families.get(family_id)
            if not family:
                continue
            for spouse_id in (family.husband_id, family.wife_id):
                if spouse_id and spouse_id != person_id and spouse_id in self.people:
                    spouses.append(self.people[spouse_id])
        return spouses

    def find_by_name(self, query: str) -> list[Person]:
        query = query.lower()
        return [p for p in self.people.values() if query in p.full_name.lower()]


if __name__ == "__main__":
    import sys

    path = sys.argv[1] if len(sys.argv) > 1 else "data/familia_miglioli.ged"
    tree = GedcomTree(path)
    print(f"Pessoas: {len(tree.people)}")
    print(f"Famílias: {len(tree.families)}")
    print(f"Fontes: {len(tree.sources)}")
