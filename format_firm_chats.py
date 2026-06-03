import re
with open("Servicebook/src/app/components/firm/FirmChats.tsx", "r") as f:
    content = f.read()

content = content.replace("export function EmployeeChats() {", "import { FirmSidebar } from './FirmSidebar';\n\nexport function FirmChats() {")

content = re.sub(
    r'\{/\* Left Sidebar - Navigation \*/\}.*?(?=\{/\* )',
    '<FirmSidebar />\n\n      ',
    content,
    flags=re.DOTALL
)

with open("Servicebook/src/app/components/firm/FirmChats.tsx", "w") as f:
    f.write(content)
