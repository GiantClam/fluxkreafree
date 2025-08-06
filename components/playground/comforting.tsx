import React, { useEffect, useState } from "react";

import { Locale } from "@/config";

interface ComfortingMessagesProps {
  language: Locale;
}

const ComfortingMessages: React.FC<ComfortingMessagesProps> = ({
  language,
}) => {
  const [currentMessage, setCurrentMessage] = useState("");

  const messages = {
    en: [
      "Our AI is doing push-ups to get stronger...",
      "Teaching our robots to moonwalk while processing...",
      "Counting to infinity, be right back...",
      "Convincing 1's and 0's to cooperate...",
      "Searching for the meaning of life... and your results!",
      "Trying to beat its own high score...",
      "Untangling some virtual spaghetti code...",
    ],
    zh: [
      "AI 正在做俯卧撑增强实力...",
      "正在教机器人一边处理一边跳月球步...",
      "数到无穷大，马上回来...",
      "说服1和0和睦相处...",
      "寻找人生的意义...顺便找您的结果！",
      "试图打破自己的高分记录...",
      "正在解开一些虚拟意大利面条代码...",
    ],
    fr: [
      "Notre IA fait des pompes pour devenir plus forte...",
      "En train d'enseigner aux robots à moonwalk tout en traitant...",
      "Comptage jusqu'à l'infini, je reviens tout de suite...",
      "Convaincre les 1 et les 0 de coopérer...",
      "À la recherche du sens de la vie... et de vos résultats !",
      "Essayant de battre son propre record...",
      "Déroulant un peu de code spaghetti virtuel...",
    ],
    tw: [
      "AI 正在練肌肉，等會兒要讓你驚豔",
      "機器人邊跳月球舞一邊算數，真是忙碌又充實",
      "我這邊正跟無限大較勁，馬上回來報告好消息！",
      "正在努力讓數字和字母和睦相處，請稍候片刻",
      "在尋找人生的解答，順便幫你把結果也找出來",
      "想要打破紀錄的 AI，正在努力中，請給它點時間",
    ],
    ja: [
      "AIがプロテインを飲んでパワーアップ中...",
      "ロボットに羊を数えさせています。お待ちください...",
      "量子の海で泳いでいます。すぐ戻ってきます！",
      "0と1を説得して仲良くさせています...",
      "人生の意味を探しています...そしてあなたの結果も",
      "AIが自分のハイスコアに挑戦中です...",
    ],
    ko: [
      "AI가 헬스장에서 열심히 운동 중입니다...",
      "로봇들에게 달빛 춤을 가르치면서 작업 중...",
      "무한대까지 세어보는 중, 잠시만 기다려주세요...",
      "0과 1이 협력하기로 결정했습니다...",
      "인생의 의미를 찾아 헤매다가... 당신의 결과를 찾았습니다",
    ],
    de: [
      "Unsere KI macht Liegestützen, um stärker zu werden...",
      "Unsere Roboter lernen gerade den Moonwalk, während sie arbeiten...",
      "Zählen bis ins Unendliche, bin gleich wieder da...",
      "Überzeugen die Einsen und Nullen, zusammenzuarbeiten...",
    ],
    es: [
      "Preparando el desayuno para los bits... Un momento, falta el café!",
      "Encontrando la tecla Enter perdida... Ah, ahí está!",
      "Ajustando el brillo de los píxeles... Un toque más... Perfecto!",
    ],
    pt: [
      "Preparando o café para os bits... Um momento, onde está o açúcar?",
      "Ensinando os bytes a dançar lambada... Vamos, vocês podem!",
      "Ajustando o volume dos pixels... Um toque mais alto... Perfeito!",
    ],
    ar: [
      "نظامنا الذكي يقوم بالضغط على الأرض ليصبح أقوى...",
      "نعلم إنسالتنا كيف تتحرك بطريقة مون ووك أثناء المعالجة...",
      "نحن نعد إلى اللانهاية، سنعود للتو...",
    ],
  };

  useEffect(() => {
    const changeMessage = () => {
      const currentMessages = messages[language];
      const randomIndex = Math.floor(Math.random() * currentMessages.length);
      setCurrentMessage(currentMessages[randomIndex]);
    };

    changeMessage();

    const intervalId = setInterval(
      () => {
        changeMessage();
      },
      Math.random() * 1000 + 3000,
    );

    return () => clearInterval(intervalId);
  }, [language]);

  return <div>{currentMessage}</div>;
};

export default ComfortingMessages; 