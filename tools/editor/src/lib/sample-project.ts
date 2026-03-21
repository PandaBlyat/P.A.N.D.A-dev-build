import type { Project } from './types';
import { importXml } from './xml-import';

export type ProjectBundle = {
  project: Project;
  systemStrings: Map<string, string>;
};

const SAMPLE_PROJECT_XML = `<?xml version="1.0" encoding="utf-8"?>
<string_table>


    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CONVERSATION 1: Template Conversation -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <string id="st_pda_ic_loner_1_precond">
        <text>req_npc_friendly:stalker</text>
    </string>
    <string id="st_pda_ic_loner_1_open">
        <text>Hey how do i make a conversation?</text>
    </string>
    <string id="st_pda_ic_loner_1_choice_1">
        <text>It's easyyyyy</text>
    </string>
    <string id="st_pda_ic_loner_1_reply_1">
        <text>Well are you going to explain?</text>
    </string>
    <string id="st_pda_ic_loner_1_outcome_1">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_cont_1">
        <text>2</text>
    </string>
    <string id="st_pda_ic_loner_1_choice_2">
        <text>i really dont want to be associated with you.</text>
    </string>
    <string id="st_pda_ic_loner_1_reply_2">
        <text>But..i need help :C</text>
    </string>
    <string id="st_pda_ic_loner_1_outcome_2">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_cont_2">
        <text>3</text>
    </string>
    <string id="st_pda_ic_loner_1_t2_choice_1">
        <text>Well...hmmm 1s</text>
    </string>
    <string id="st_pda_ic_loner_1_t2_reply_1">
        <text>Take your time</text>
    </string>
    <string id="st_pda_ic_loner_1_t2_outcome_1">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_t2_cont_1">
        <text>4</text>
    </string>
    <string id="st_pda_ic_loner_1_t2_choice_2">
        <text>I honestly cant be bothered to help you</text>
    </string>
    <string id="st_pda_ic_loner_1_t2_reply_2">
        <text>Then why brag that its easy then?? </text>
    </string>
    <string id="st_pda_ic_loner_1_t2_outcome_2">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_t2_cont_2">
        <text>6</text>
    </string>
    <string id="st_pda_ic_loner_1_t3_choice_1">
        <text>Nah get away from me!</text>
    </string>
    <string id="st_pda_ic_loner_1_t3_reply_1">
        <text>You used to be cool, honestly. Idk what happened to you</text>
    </string>
    <string id="st_pda_ic_loner_1_t3_outcome_1">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_t3_cont_1">
        <text>5</text>
    </string>
    <string id="st_pda_ic_loner_1_t3_choice_2">
        <text>Aww alright, didnt mean to come across like that just messing</text>
    </string>
    <string id="st_pda_ic_loner_1_t3_reply_2">
        <text>np bro so how does this work?</text>
    </string>
    <string id="st_pda_ic_loner_1_t3_outcome_2">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_t3_cont_2">
        <text>4</text>
    </string>
    <string id="st_pda_ic_loner_1_t4_choice_1">
        <text>Actually something just happened, talk to you later buddy</text>
    </string>
    <string id="st_pda_ic_loner_1_t4_reply_1">
        <text>how do i downvote this shit?</text>
    </string>
    <string id="st_pda_ic_loner_1_t4_outcome_1">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_t4_cont_1">
        <text>9</text>
    </string>
    <string id="st_pda_ic_loner_1_t4_choice_2">
        <text>Well every conversation needs a starter msg from the npc and..that's about it. up to you on how complex to make the conv</text>
    </string>
    <string id="st_pda_ic_loner_1_t4_reply_2">
        <text>im still confused but thanks, tools take time getting used to</text>
    </string>
    <string id="st_pda_ic_loner_1_t4_outcome_2">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_t5_choice_1">
        <text>You dont know me!</text>
    </string>
    <string id="st_pda_ic_loner_1_t5_reply_1">
        <text>Truth is the game was rigged from the start.</text>
    </string>
    <string id="st_pda_ic_loner_1_t5_outcome_1">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_t5_cont_1">
        <text>7</text>
    </string>
    <string id="st_pda_ic_loner_1_t5_choice_2">
        <text>Well yeah im old and bitter now! get off my lawn!</text>
    </string>
    <string id="st_pda_ic_loner_1_t5_reply_2">
        <text>yea yea im leaving</text>
    </string>
    <string id="st_pda_ic_loner_1_t5_outcome_2">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_t6_choice_1">
        <text>Idk i get a rush from feeling superior to others</text>
    </string>
    <string id="st_pda_ic_loner_1_t6_reply_1">
        <text>get help</text>
    </string>
    <string id="st_pda_ic_loner_1_t6_outcome_1">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_t6_choice_2">
        <text>bc its funny?</text>
    </string>
    <string id="st_pda_ic_loner_1_t6_reply_2">
        <text>fuck you</text>
    </string>
    <string id="st_pda_ic_loner_1_t6_outcome_2">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_t7_choice_1">
        <text>Eyyyy Fallout new vegas, good shit</text>
    </string>
    <string id="st_pda_ic_loner_1_t7_reply_1">
        <text>Yea boii, remaster is coming im telling you!</text>
    </string>
    <string id="st_pda_ic_loner_1_t7_outcome_1">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_t7_cont_1">
        <text>8</text>
    </string>
    <string id="st_pda_ic_loner_1_t7_choice_2">
        <text>I dont get it</text>
    </string>
    <string id="st_pda_ic_loner_1_t7_reply_2">
        <text>nvm</text>
    </string>
    <string id="st_pda_ic_loner_1_t7_outcome_2">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_t8_choice_1">
        <text>Nah those are just rumours, dont get hyped</text>
    </string>
    <string id="st_pda_ic_loner_1_t8_reply_1">
        <text>people said the same about Oblivion tho!</text>
    </string>
    <string id="st_pda_ic_loner_1_t8_outcome_1">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_t9_choice_1">
        <text>You need to pay for the premium version of the editor</text>
    </string>
    <string id="st_pda_ic_loner_1_t9_reply_1">
        <text>Good one</text>
    </string>
    <string id="st_pda_ic_loner_1_t9_outcome_1">
        <text>none</text>
    </string>
    <string id="st_pda_ic_loner_1_timeout">
        <text>400</text>
    </string>
    <string id="st_pda_ic_loner_1_timeout_msg">
        <text>You really gonna leave me out here alone?</text>
    </string>

</string_table>`;

export function createSampleProjectBundle(): ProjectBundle {
  const imported = importXml(SAMPLE_PROJECT_XML);

  if (!imported) {
    throw new Error('Failed to import bundled sample project XML.');
  }

  const [firstConversation] = imported.project.conversations;
  if (firstConversation) {
    firstConversation.label = 'Template Conversation';
  }

  return imported;
}
