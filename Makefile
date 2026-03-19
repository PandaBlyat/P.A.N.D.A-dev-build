.PHONY: doctor doctor-strict lua-lint xml-lint check setup-tools treasure-possible-items editor-dev editor-build

export PATH := $(CURDIR)/tools/bin:$(PATH)

setup-tools:
	./tools/setup_modding_env.sh

doctor:
	python3 tools/mod_doctor.py

doctor-strict:
	python3 tools/mod_doctor.py --strict

lua-lint:
	luacheck "P.A.N.D.A DEV/gamedata/scripts" --codes

xml-lint:
	find "P.A.N.D.A DEV/gamedata/configs" -name "*.xml" \
		! -path "P.A.N.D.A DEV/gamedata/configs/text/eng/st_PANDA_loner_interactive_conversations.xml" \
		-print0 | xargs -0 -I{} xmllint --noout "{}"

check: doctor


treasure-possible-items:
	@echo "Usage: make treasure-possible-items ITEMS_ROOT=... TREASURE_LTX=... [OUT=possible_items_clean.ltx]"
	python3 tools/build_treasure_possible_items.py --items-root "$(ITEMS_ROOT)" --treasure-ltx "$(TREASURE_LTX)" $(if $(OUT),--output "$(OUT)",)

editor-dev:
	cd tools/editor && npm install && npx vite

editor-build:
	cd tools/editor && npm install && npx vite build
