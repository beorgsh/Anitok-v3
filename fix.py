with open('src/lib/firebaseStore.ts', 'r') as f:
    text = f.read()

text = text.replace('  }\n}\n};\n', '  }\n};\n')

with open('src/lib/firebaseStore.ts', 'w') as f:
    f.write(text)
