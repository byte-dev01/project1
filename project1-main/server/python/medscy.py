import medspacy

# 创建管道（已自动加载 context 模块）
nlp = medspacy.load()

text = """
The patient has pneumonia in the right lower lobe.
No signs of pneumothorax or pleural effusion.
Family history of diabetes.
The patient had tuberculosis in childhood.
"""

doc = nlp(text)

print("✅ 当前存在的疾病实体：")
for pipe_name, _ in nlp.pipeline:
    print(f"Loaded pipeline component: {pipe_name}")

for ent in doc.ents:
    if (
        not ent._.is_negated and
        ent._.temporality != "historical" and
        ent._.experiencer != "family"
    ):
        print(f"- {ent.text}")