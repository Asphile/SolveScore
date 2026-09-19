from pydantic import BaseModel, Field, field_validator


class RubricCriterionInput(BaseModel):
    name: str
    description: str = ""
    weight: float = Field(gt=0, le=1)
    minimum_score: int = 1
    maximum_score: int = 10
    display_order: int = 0


class RubricCreateRequest(BaseModel):
    name: str
    criteria: list[RubricCriterionInput]

    @field_validator("criteria")
    @classmethod
    def weights_total_100(cls, v: list[RubricCriterionInput]) -> list[RubricCriterionInput]:
        if not v:
            raise ValueError("A rubric must have at least one criterion")
        total = round(sum(c.weight for c in v), 4)
        if total != 1.0:
            raise ValueError(f"Rubric criteria weights must total 100% (got {total * 100:.1f}%)")
        return v


class RubricCriterionResponse(BaseModel):
    id: str
    name: str
    description: str
    weight: float
    minimum_score: int
    maximum_score: int
    display_order: int

    model_config = {"from_attributes": True}


class RubricResponse(BaseModel):
    id: str
    competition_id: str
    name: str
    active: bool
    criteria: list[RubricCriterionResponse]

    model_config = {"from_attributes": True}
