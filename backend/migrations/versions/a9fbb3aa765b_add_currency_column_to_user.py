"""Add currency column to User

Revision ID: a9fbb3aa765b
Revises: 2e1ed256c4af
Create Date: 2025-10-25 12:36:43.429818

"""
from alembic import op
import sqlalchemy as sa

revision = 'a9fbb3aa765b'
down_revision = '2e1ed256c4af'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('currency', sa.String(length=3), nullable=False, server_default='GBP'))

def downgrade():
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('currency')
