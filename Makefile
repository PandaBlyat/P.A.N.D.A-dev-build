.PHONY: doctor doctor-strict lua-lint xml-lint check setup-tools

setup-tools:
	./tools/setup_modding_env.sh

doctor:
	python3 tools/mod_doctor.py

doctor-strict:
	python3 tools/mod_doctor.py --strict

lua-lint:
	luacheck "P.A.N.D.A DEV/gamedata/scripts" --codes

xml-lint:
	find "P.A.N.D.A DEV/gamedata/configs" -name "*.xml" -print0 | xargs -0 -I{} xmllint --noout "{}"

check: doctor
