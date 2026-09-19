"""Development seed data: 1 admin, 20 judges, 20 schools, 1 competition with an
active rubric, sample applications, and sample evaluations for testing score
consolidation. Development credentials only -- never use these in production.

Run with: venv/Scripts/python.exe -m app.seed
"""

import random
from datetime import datetime, timedelta, timezone

from app.core.security import hash_password
from app.database import SessionLocal, init_db
from app.models.application import Application
from app.models.competition import Competition, CompetitionParticipant, JudgeAssignment
from app.models.enums import ApplicationStatus, CompetitionStatus, EvaluationStatus, UserRole
from app.models.evaluation import Evaluation, EvaluationScore
from app.models.rubric import Rubric, RubricCriterion
from app.models.school import School
from app.models.user import User

DEV_PASSWORD = "DevPass123"  # development-only seed password


def run() -> None:
    init_db()
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == "admin@solvescore.dev").first():
            print("Seed data already present -- skipping.")
            return

        admin = User(
            first_name="Aphiwamambo",
            last_name="Mkhize",
            email="admin@solvescore.dev",
            password_hash=hash_password(DEV_PASSWORD),
            role=UserRole.ADMIN,
        )
        db.add(admin)
        db.flush()

        judges = []
        for i in range(1, 21):
            judge = User(
                first_name="Judge",
                last_name=f"{i:02d}",
                email=f"judge{i:02d}@solvescore.dev",
                password_hash=hash_password(DEV_PASSWORD),
                role=UserRole.JUDGE,
            )
            db.add(judge)
            judges.append(judge)
        db.flush()

        competition = Competition(
            name="Samsung Solve for Tomorrow 2026",
            description="Live judging competition for Solve for Tomorrow finalist schools.",
            theme="Technology for community impact",
            eligibility="Registered South African high schools",
            status=CompetitionStatus.JUDGING_OPEN,
            max_participants=20,
            application_open_date=datetime.now(timezone.utc) - timedelta(days=30),
            application_close_date=datetime.now(timezone.utc) - timedelta(days=5),
            judging_open_date=datetime.now(timezone.utc) - timedelta(days=1),
            judging_close_date=datetime.now(timezone.utc) + timedelta(days=1),
            created_by=admin.id,
        )
        db.add(competition)
        db.flush()

        rubric = Rubric(competition_id=competition.id, name="Standard Rubric", active=True)
        db.add(rubric)
        db.flush()
        criteria = [
            RubricCriterion(rubric_id=rubric.id, name="Innovation", description="Originality of the idea", weight=0.40, minimum_score=1, maximum_score=10, display_order=1),
            RubricCriterion(rubric_id=rubric.id, name="Feasibility", description="Practicality of implementation", weight=0.30, minimum_score=1, maximum_score=10, display_order=2),
            RubricCriterion(rubric_id=rubric.id, name="Impact", description="Expected community impact", weight=0.30, minimum_score=1, maximum_score=10, display_order=3),
        ]
        db.add_all(criteria)
        db.flush()

        for judge in judges:
            db.add(JudgeAssignment(competition_id=competition.id, judge_id=judge.id))

        school_names = [f"School {chr(65 + i)}" for i in range(20)]  # School A..T
        applications = []
        for idx, name in enumerate(school_names):
            user = User(
                first_name=name,
                last_name="Coordinator",
                email=f"school{idx + 1:02d}@solvescore.dev",
                password_hash=hash_password(DEV_PASSWORD),
                role=UserRole.SCHOOL,
            )
            db.add(user)
            db.flush()

            school = School(
                user_id=user.id,
                school_name=name,
                registration_number=f"REG-{idx + 1:04d}",
                province="Gauteng",
                district="Johannesburg",
                address="123 Example Street",
                contact_name=f"{name} Coordinator",
                contact_email=user.email,
                contact_phone="0110000000",
            )
            db.add(school)
            db.flush()

            db.add(CompetitionParticipant(competition_id=competition.id, school_id=school.id))

            application = Application(
                competition_id=competition.id,
                school_id=school.id,
                project_title=f"{name} Community Water Project",
                problem_description="Limited access to clean water in the local community.",
                solution_description="A low-cost filtration and monitoring system.",
                innovation_description="Combines low-cost sensors with a community reporting app.",
                impact_description="Improves water access for approximately 5,000 residents.",
                implementation_plan="Pilot with local municipality over two terms.",
                technology_used="Arduino, Python, mobile app",
                category="Environment",
                status=ApplicationStatus.APPROVED,
                submitted_at=datetime.now(timezone.utc) - timedelta(days=10),
                approved_at=datetime.now(timezone.utc) - timedelta(days=7),
            )
            db.add(application)
            db.flush()
            applications.append(application)

        db.flush()

        # Sample evaluations: every judge scores every school so results consolidation is testable.
        rng = random.Random(42)
        for application in applications:
            for judge in judges:
                evaluation = Evaluation(
                    competition_id=competition.id,
                    judge_id=judge.id,
                    application_id=application.id,
                    status=EvaluationStatus.SUBMITTED,
                    strengths="Strong community focus and clear problem definition.",
                    improvements="Consider scalability and long-term maintenance costs.",
                    comments="Solid overall submission.",
                    submitted_at=datetime.now(timezone.utc),
                )
                db.add(evaluation)
                db.flush()

                total = 0.0
                for criterion in criteria:
                    score = rng.randint(6, 10)
                    contribution = (score / criterion.maximum_score) * criterion.weight * 100
                    total += contribution
                    db.add(EvaluationScore(evaluation_id=evaluation.id, criterion_id=criterion.id, score=score, weighted_contribution=contribution))
                evaluation.weighted_total = round(total, 2)

        db.commit()

        print("Seed data created.")
        print(f"Admin login:  admin@solvescore.dev / {DEV_PASSWORD}")
        print(f"Judge login:  judge01@solvescore.dev .. judge20@solvescore.dev / {DEV_PASSWORD}")
        print(f"School login: school01@solvescore.dev .. school20@solvescore.dev / {DEV_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
