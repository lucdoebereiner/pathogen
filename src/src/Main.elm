port module Main exposing (..)

import Browser
import Browser.Dom as Dom
import Browser.Events as Events
import Color exposing (Color)
import Element exposing (..)
import Element.Background as Background
import Element.Border as Border
import Element.Font as Font
import Element.Input as Input
import Html exposing (Html)
import Json.Decode as Decode exposing (Decoder, Value, decodeValue, float, int, list)
import Json.Decode.Pipeline exposing (required)
import List.Extra as L
import Markdown.Parser
import Markdown.Renderer
import Task
import Text
import TypedSvg exposing (circle, g, line, svg)
import TypedSvg.Attributes as SvgAttr
    exposing
        ( cx
        , cy
        , noFill
        , r
        , stroke
        , strokeWidth
        , viewBox
        , x1
        , x2
        , y1
        , y2
        )
import TypedSvg.Core exposing (Svg)
import TypedSvg.Types exposing (Length(..), Paint(..))


main : Program () Model Msg
main =
    Browser.element
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }


port receiveState : (Value -> msg) -> Sub msg


port receiveMicLevel : (Float -> msg) -> Sub msg


port receiveRecordingTime : (Float -> msg) -> Sub msg


port allowRecording : (Bool -> msg) -> Sub msg


port started : (Bool -> msg) -> Sub msg


port start : () -> Cmd msg


port openMic : () -> Cmd msg


port record : () -> Cmd msg


type alias PathogenId =
    Int


type alias Pathogen =
    { id : PathogenId }


pathogenDecoder : Decoder Pathogen
pathogenDecoder =
    Decode.succeed Pathogen
        |> required "id" int


type AntiBodyType
    = Plasma
    | Memory PathogenId
    | Matching PathogenId


pathogenId : AntiBody -> PathogenId
pathogenId ab =
    case ab.state of
        Memory p ->
            p

        Matching p ->
            p

        _ ->
            0


antiBodyTypeDecoder : Decoder AntiBodyType
antiBodyTypeDecoder =
    Decode.field "state" Decode.string
        |> Decode.andThen antiBodyTypeDecoderAux


antiBodyTypeDecoderAux : String -> Decoder AntiBodyType
antiBodyTypeDecoderAux state =
    case state of
        "plasma" ->
            Decode.succeed Plasma

        "matching" ->
            Decode.map Matching (Decode.field "pathogen" int)

        "memory" ->
            Decode.map Memory (Decode.field "pathogen" int)

        _ ->
            Decode.fail <|
                "Trying to decode state, but  "
                    ++ state
                    ++ " is not supported."


type alias AntiBodyId =
    Int


type alias LevelState =
    { target : Float
    , current : Float
    }


initLevel : Float -> LevelState
initLevel f =
    { target = f, current = 0.0 }


tickLevel : LevelState -> LevelState
tickLevel l =
    if l.current == l.target then
        l

    else if abs (l.current - l.target) < 0.05 then
        { l | current = l.target }

    else
        { l | current = l.current * 0.95 + (l.target * 0.05) }


setTargetLevel : Float -> LevelState -> LevelState
setTargetLevel target l =
    { l | target = target }


updateAntiBodies : List AntiBody -> List AntiBody -> List AntiBody -> List AntiBody
updateAntiBodies oldabs abs result =
    case abs of
        [] ->
            result

        newAb :: rest ->
            let
                toAdd =
                    case L.find (\antib -> antib.id == newAb.id) oldabs of
                        Just oldAb ->
                            { oldAb | level = setTargetLevel newAb.level.target oldAb.level }

                        Nothing ->
                            newAb
            in
            updateAntiBodies oldabs rest (toAdd :: result)


type alias AntiBody =
    { posX : Float
    , posZ : Float
    , level : LevelState
    , state : AntiBodyType
    , id : AntiBodyId
    }


antiBodyDecoder : Decoder AntiBody
antiBodyDecoder =
    Decode.succeed (\x y l -> AntiBody x y (initLevel l))
        |> required "posX" float
        |> required "posZ" float
        |> required "level" float
        |> required "state" antiBodyTypeDecoder
        |> required "id" int


decodeInfo : Decoder { pathogens : List Pathogen, antiBodies : List AntiBody }
decodeInfo =
    Decode.succeed (\p a -> { pathogens = p, antiBodies = a })
        |> required "pathogens" (list pathogenDecoder)
        |> required "antiBodies" (list antiBodyDecoder)


type View
    = AntiBodies
    | MicInput
    | Recording
    | Welcome


type alias Model =
    { view : View
    , pathogens : List Pathogen
    , antiBodies : List AntiBody
    , size : { width : Int, height : Int }
    , micLevel : Maybe Float
    , recordingTime : Float
    , allowRecording : Bool
    , render : Bool
    }


type Msg
    = ReceivedInfo Value
    | ReceivedMicLevel Float
    | ReceivedRecordingTime Float
    | AllowRecording Bool
    | Resize ( Int, Int )
    | GotViewport Dom.Viewport
    | Tick Float
    | Start
    | OpenMic
    | StartRecording
    | SetStarted Bool


init : () -> ( Model, Cmd Msg )
init flags =
    ( { view = Welcome
      , pathogens = []
      , antiBodies = []
      , size =
            { width = 1440
            , height = 900
            }
      , micLevel = Nothing
      , recordingTime = 0.0
      , allowRecording = False
      , render = True
      }
    , Task.perform GotViewport Dom.getViewport
    )


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Start ->
            ( { model | view = AntiBodies }, start () )

        SetStarted _ ->
            ( { model
                | view = AntiBodies
                , recordingTime = 0.0
                , micLevel = Nothing
                , allowRecording = False
              }
            , Cmd.none
            )

        AllowRecording _ ->
            ( { model | allowRecording = True }, Cmd.none )

        OpenMic ->
            ( { model | view = MicInput }, openMic () )

        StartRecording ->
            ( { model | view = Recording }, record () )

        ReceivedMicLevel l ->
            ( { model | micLevel = Just l }, Cmd.none )

        ReceivedRecordingTime t ->
            ( { model | recordingTime = t }, Cmd.none )

        ReceivedInfo v ->
            case decodeValue decodeInfo v of
                Ok i ->
                    let
                        newAbs =
                            updateAntiBodies model.antiBodies i.antiBodies []
                    in
                    ( { model
                        | pathogens = i.pathogens
                        , antiBodies = newAbs
                      }
                    , Cmd.none
                    )

                e ->
                    let
                        _ =
                            Debug.log "error" e
                    in
                    ( model, Cmd.none )

        Tick _ ->
            if model.render then
                ( { model
                    | antiBodies =
                        List.map (\a -> { a | level = tickLevel a.level })
                            model.antiBodies
                    , render = False
                  }
                , Cmd.none
                )

            else
                ( { model | render = True }, Cmd.none )

        Resize ( w, h ) ->
            ( { model
                | size =
                    { width = w
                    , height = h
                    }
              }
            , Cmd.none
            )

        GotViewport v ->
            ( { model
                | size =
                    { width = round v.viewport.width
                    , height = round v.viewport.height
                    }
              }
            , Cmd.none
            )


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.batch
        [ receiveState ReceivedInfo
        , receiveMicLevel ReceivedMicLevel
        , receiveRecordingTime ReceivedRecordingTime
        , allowRecording AllowRecording
        , started SetStarted
        , Events.onResize (\w h -> Resize ( w, h ))
        , Events.onAnimationFrameDelta Tick
        ]


linlin : Float -> Float -> Float -> Float -> Float -> Float
linlin x inMin inMax outMin outMax =
    if x <= inMin then
        outMin

    else if x >= inMax then
        outMax

    else
        (x - inMin) / (inMax - inMin) * (outMax - outMin) + outMin


mapX : Float -> Float
mapX p =
    linlin p -15.5 15.5 0.0 1.0


mapZ : Float -> Float
mapZ p =
    linlin p -15.5 15.5 1.0 0.0


drawPlasma : AntiBody -> Svg msg
drawPlasma ab =
    let
        radius =
            linlin ab.level.current 0.0 2.0 0.0 0.02
    in
    circle
        [ cx (Px (mapX ab.posX))
        , cy (Px (mapZ ab.posZ))
        , r (Px radius)
        , stroke (Paint Color.darkGrey)
        , strokeWidth (Px 0.005)
        , SvgAttr.fill (Paint Color.darkGrey)
        ]
        []


pickColor : PathogenId -> Color.Color
pickColor id =
    case modBy 4 id of
        0 ->
            Color.rgb255 255 0 0

        1 ->
            Color.rgb255 255 62 0

        2 ->
            Color.rgb255 255 124 0

        3 ->
            Color.rgb255 255 193 0

        _ ->
            Color.black


drawMatching : AntiBody -> Svg msg
drawMatching ab =
    let
        radius =
            linlin ab.level.current 0.0 2.0 0.0 0.03
    in
    circle
        [ cx (Px (mapX ab.posX))
        , cy (Px (mapZ ab.posZ))
        , r (Px radius)
        , stroke (Paint Color.gray)
        , strokeWidth (Px 0.005)
        , SvgAttr.fill (Paint (pickColor (pathogenId ab)))
        ]
        []


drawMemory : AntiBody -> Svg msg
drawMemory ab =
    let
        radius =
            linlin ab.level.current 0.0 2.0 0.01 0.03
    in
    circle
        [ cx (Px (mapX ab.posX))
        , cy (Px (mapZ ab.posZ))
        , r (Px radius)
        , stroke (Paint Color.black)
        , strokeWidth (Px 0.005)
        , SvgAttr.fill (Paint (pickColor (pathogenId ab)))
        ]
        []


inlineCircle : Color.Color -> Color.Color -> Element msg
inlineCircle strokeC fillC =
    html <|
        svg
            [ SvgAttr.width (Px 40)
            , SvgAttr.height (Px 40)
            , viewBox 0 0 1 1
            ]
            [ circle
                [ cx (Px 0.5)
                , cy (Px 0.5)
                , r (Px 0.3)
                , stroke (Paint strokeC)
                , strokeWidth (Px 0.1)
                , SvgAttr.fill (Paint fillC)
                ]
                []
            ]


redCircle x y =
    circle
        [ cx (Px (mapX x))
        , cy (Px (mapZ y))
        , r (Px 0.01)
        , stroke (Paint Color.gray)
        , strokeWidth (Px 0.005)
        , SvgAttr.fill (Paint Color.red)
        ]
        []


colorToEl : Color.Color -> Float -> Element.Color
colorToEl c a =
    let
        rgbaColor =
            Color.toRgba c
    in
    rgba rgbaColor.red rgbaColor.green rgbaColor.blue a


viewPathogen : List AntiBody -> Pathogen -> Element msg
viewPathogen abs p =
    let
        memory =
            List.any
                (\a ->
                    case a.state of
                        Memory pid ->
                            pid == p.id

                        _ ->
                            False
                )
                abs

        matching =
            List.any
                (\a ->
                    case a.state of
                        Matching pid ->
                            pid == p.id

                        _ ->
                            False
                )
                abs

        stateString =
            if memory then
                el [ Font.bold ] <| text "Memory cell"

            else if matching then
                el [] <| text "Ongoing adaptation"

            else
                none
    in
    if not memory && not matching then
        none

    else
        column [ Background.color (colorToEl (pickColor p.id) 0.8), width shrink, centerX, Border.solid, Border.width 1, padding 10 ]
            [ stateString
            ]


viewPathogens : Model -> Element msg
viewPathogens model =
    if List.length model.pathogens > 0 then
        row [ width fill, spacing 10, centerX ] <|
            (el [ centerX ] <|
                text "Current pathogens:"
            )
                :: List.map (viewPathogen model.antiBodies) model.pathogens

    else
        none


type alias DrawingSize =
    { width : Int
    , height : Int
    }


visualization : DrawingSize -> Model -> Html msg
visualization drawingSize model =
    let
        abCircles =
            List.map
                (\ab ->
                    case ab.state of
                        Plasma ->
                            drawPlasma ab

                        Matching _ ->
                            drawMatching ab

                        Memory _ ->
                            drawMemory ab
                )
                model.antiBodies
    in
    svg
        [ SvgAttr.width (Px (toFloat drawingSize.width))
        , SvgAttr.height (Px (toFloat drawingSize.height))
        , viewBox 0 0 1 1
        ]
        abCircles


startButton : Element Msg
startButton =
    Input.button
        [ Border.width 1
        , Border.solid
        , Font.size 18
        , padding 10
        ]
        { onPress = Just Start
        , label = text "Start"
        }


startRecButton : Element Msg
startRecButton =
    Input.button
        [ Border.width 1
        , Border.solid
        , Font.size 18
        , padding 10
        ]
        { onPress = Just StartRecording
        , label = text "Record 3 seconds"
        }


recButton : Element Msg
recButton =
    Input.button
        [ Border.width 1
        , Border.solid
        , Font.size 18
        , padding 10
        ]
        { onPress = Just OpenMic
        , label = text "Record Pathogen"
        }


viewMicLevel : Maybe Float -> Element msg
viewMicLevel l =
    case l of
        Nothing ->
            el [ paddingXY 10 20, Font.bold, centerX ] <| text "No input"

        Just level ->
            let
                db =
                    toFloat (round (level * 10)) / 10.0
            in
            el [ paddingXY 10 20, centerX, Font.bold ]
                (text ("Input level: " ++ (String.fromFloat db ++ "dB")))


mdToEl : String -> Element msg
mdToEl md =
    case render Markdown.Renderer.defaultHtmlRenderer md of
        Ok htmls ->
            paragraph [ width fill ] (List.map html htmls)

        Err prob ->
            none


deadEndsToString deadEnds =
    deadEnds
        |> List.map Markdown.Parser.deadEndToString
        |> String.join "\n"


render renderer markdown =
    markdown
        |> Markdown.Parser.parse
        |> Result.mapError deadEndsToString
        |> Result.andThen (\ast -> Markdown.Renderer.render renderer ast)


view : Model -> Html Msg
view model =
    let
        drawingSize =
            { width = round (toFloat model.size.width * 0.9)
            , height = round (toFloat model.size.height * 0.75)
            }
    in
    layout
        [ width fill
        , height fill
        , centerY
        , centerX
        , paddingEach { left = 10, right = 10, top = 10, bottom = 10 }
        , Font.size 14
        , Font.regular
        , Font.family
            [ Font.typeface "Source Code Pro"
            ]
        ]
    <|
        column [ width fill, height fill, spacing 10 ]
            [ row [ width fill, centerX ]
                [ el
                    [ Font.size
                        (if model.size.width < 1000 then
                            50

                         else
                            90
                        )
                    , centerX
                    , width fill
                    , Font.center
                    , Font.extraLight
                    , Font.family
                        [ Font.typeface "Source Code Pro"
                        , Font.monospace
                        ]
                    ]
                  <|
                    text "PATHOGEN"
                ]
            , row [ width fill, centerX ]
                [ paragraph [ width fill, centerX, Font.center ]
                    [ text "by Luc Döbereiner (2021)"
                    ]
                ]
            , row [ width fill ]
                (case model.view of
                    Welcome ->
                        [ column [ spacingXY 0 8, centerX, width (fill |> maximum 700) ]
                            [ el [ paddingXY 0 10, centerX ] startButton
                            , mdToEl Text.description1
                            , row [ width fill, spacingXY 30 0 ]
                                [ el [ paddingEach { left = 0, right = 30, top = 0, bottom = 0 } ] <|
                                    inlineCircle Color.darkGrey Color.darkGrey
                                , paragraph [ width fill ]
                                    [ text "Random plasma cells that may be used as a basis for a clonal mutation process."
                                    ]
                                ]
                            , row [ width fill, spacingXY 30 0 ]
                                [ el [ paddingEach { left = 0, right = 30, top = 0, bottom = 0 } ] <|
                                    inlineCircle Color.gray Color.red
                                , paragraph [ width fill ]
                                    [ text "Iteratively produced clones that are compared to a specific pathogen that the system tries to adapt to."
                                    ]
                                ]
                            , row [ width fill, spacingXY 30 0 ]
                                [ el [ paddingEach { left = 0, right = 30, top = 0, bottom = 0 } ] <|
                                    inlineCircle Color.black Color.red
                                , paragraph [ width fill ]
                                    [ text "Memory cells that remain once the adaptation has been completed."
                                    ]
                                ]
                            , mdToEl Text.description3
                            ]
                        ]

                    MicInput ->
                        [ column [ width fill, spacingXY 0 10, centerX ]
                            [ viewMicLevel model.micLevel
                            , if model.allowRecording then
                                el [ centerX ] <| startRecButton

                              else
                                none
                            ]
                        ]

                    Recording ->
                        [ column [ width fill, spacingXY 0 0 ]
                            [ viewMicLevel model.micLevel
                            , el [ paddingXY 10 10, centerX, Font.bold ]
                                (text (String.fromInt (round (3.0 - model.recordingTime)) ++ " second(s) remaining"))
                            ]
                        ]

                    AntiBodies ->
                        [ column [ width fill, centerX, spacing 10 ]
                            [ if List.length model.pathogens < 4 then
                                el [ centerX ] <| recButton

                              else
                                none
                            , viewPathogens model
                            , el [ width (px drawingSize.width), centerX ] <|
                                html <|
                                    visualization drawingSize model
                            ]
                        ]
                )
            ]
